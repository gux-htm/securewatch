// Package watcher monitors a directory recursively using fsnotify.
// On each file system event it computes SHA-256 hashes, determines an
// integrity flag, signs the payload with HMAC-SHA256, and sends it to Kafka.
package watcher

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// FileEvent is the payload sent to Kafka topic securewatch.file-events.
type FileEvent struct {
	TenantID      string    `json:"tenantId"`
	ResourcePath  string    `json:"resourcePath"`
	EventType     string    `json:"eventType"`
	ActorUsername string    `json:"actorUsername"`
	ActorIP       string    `json:"actorIp"`
	ActorMAC      string    `json:"actorMac"`
	HashBefore    string    `json:"hashBefore"`
	HashAfter     string    `json:"hashAfter"`
	HashChanged   bool      `json:"hashChanged"`
	IntegrityFlag string    `json:"integrityFlag"`
	FlagReason    string    `json:"flagReason"`
	DigitalSig    string    `json:"digitalSig"`
	OccurredAt    time.Time `json:"occurredAt"`
}

// Config holds watcher configuration.
type Config struct {
	MonitoredPath  string
	TenantID       string
	HMACKey        string
	KafkaBrokers   []string
	APIBaseURL     string
	// ApprovedUsers is refreshed every 5 min from the API.
	ApprovedUsers  []string
}

// Watcher watches a directory and emits signed FileEvents to Kafka.
type Watcher struct {
	cfg       Config
	hashCache sync.Map // map[string]string — filepath → last known SHA-256
	mu        sync.RWMutex
	approved  map[string]bool
}

// New creates a Watcher. Call Start() to begin watching.
func New(cfg Config) *Watcher {
	approved := make(map[string]bool)
	for _, u := range cfg.ApprovedUsers {
		approved[strings.ToLower(u)] = true
	}
	return &Watcher{cfg: cfg, approved: approved}
}

// UpdateApprovedUsers replaces the approved user list (called every 5 min).
func (w *Watcher) UpdateApprovedUsers(users []string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.approved = make(map[string]bool, len(users))
	for _, u := range users {
		w.approved[strings.ToLower(u)] = true
	}
}

// Start begins watching cfg.MonitoredPath recursively.
// publish is called for each signed event — caller wires this to Kafka.
func (w *Watcher) Start(publish func(FileEvent) error) error {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("fsnotify.NewWatcher: %w", err)
	}
	defer fsw.Close()

	// Walk and add all subdirectories
	if err := filepath.WalkDir(w.cfg.MonitoredPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable dirs
		}
		if d.IsDir() {
			return fsw.Add(path)
		}
		// Pre-populate hash cache for existing files
		if h := hashFile(path); h != "" {
			w.hashCache.Store(path, h)
		}
		return nil
	}); err != nil {
		return fmt.Errorf("walk %s: %w", w.cfg.MonitoredPath, err)
	}

	fmt.Printf("[watcher] Monitoring: %s\n", w.cfg.MonitoredPath)

	for {
		select {
		case event, ok := <-fsw.Events:
			if !ok {
				return nil
			}
			go w.handleEvent(event, publish)

		case err, ok := <-fsw.Errors:
			if !ok {
				return nil
			}
			fmt.Fprintf(os.Stderr, "[watcher] error: %v\n", err)
		}
	}
}

// ── Event handling ────────────────────────────────────────────────────────────

func (w *Watcher) handleEvent(event fsnotify.Event, publish func(FileEvent) error) {
	path := event.Name

	// Skip noisy system files
	base := filepath.Base(path)
	if strings.HasPrefix(base, "~$") || strings.HasSuffix(base, ".tmp") ||
		strings.HasSuffix(base, ".lock") || strings.EqualFold(base, "desktop.ini") ||
		strings.EqualFold(base, "thumbs.db") {
		return
	}

	eventType := resolveEventType(event.Op)
	if eventType == "" {
		return
	}

	actor := currentUser()
	ip, mac := networkInfo()

	var hashBefore, hashAfter string
	var hashChanged bool

	switch eventType {
	case "CREATED", "MODIFIED":
		if v, ok := w.hashCache.Load(path); ok {
			hashBefore, _ = v.(string)
		}
		hashAfter = hashFile(path)
		if hashAfter != "" {
			w.hashCache.Store(path, hashAfter)
		}
		hashChanged = hashBefore != hashAfter && hashBefore != ""

	case "DELETED":
		if v, ok := w.hashCache.Load(path); ok {
			hashBefore, _ = v.(string)
			w.hashCache.Delete(path)
		}

	case "ACCESSED":
		h := hashFile(path)
		hashBefore = h
		hashAfter = h
	}

	flag, reason := w.determineFlag(actor, ip, mac, eventType, hashBefore, hashAfter, hashChanged)

	fe := FileEvent{
		TenantID:      w.cfg.TenantID,
		ResourcePath:  path,
		EventType:     eventType,
		ActorUsername: actor,
		ActorIP:       ip,
		ActorMAC:      mac,
		HashBefore:    hashBefore,
		HashAfter:     hashAfter,
		HashChanged:   hashChanged,
		IntegrityFlag: flag,
		FlagReason:    reason,
		OccurredAt:    time.Now().UTC(),
	}
	fe.DigitalSig = signEvent(fe, w.cfg.HMACKey)

	if err := publish(fe); err != nil {
		fmt.Fprintf(os.Stderr, "[watcher] publish error: %v\n", err)
	}
}

// ── Integrity flag logic ──────────────────────────────────────────────────────

func (w *Watcher) determineFlag(actor, ip, mac, eventType, hashBefore, hashAfter string, hashChanged bool) (string, string) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// CRITICAL conditions (checked first)
	if !w.approved[strings.ToLower(actor)] {
		return "CRITICAL", fmt.Sprintf("actor '%s' not in approved accounts list", actor)
	}
	if eventType == "UNAUTHORISED_ACCESS_ATTEMPT" {
		return "CRITICAL", "unauthorised access attempt detected"
	}

	// SUSPICIOUS conditions
	if eventType == "PERMISSION_CHANGE" {
		return "SUSPICIOUS", "permission change detected"
	}
	if hashChanged {
		return "SUSPICIOUS", fmt.Sprintf("hash changed: %s → %s", truncate(hashBefore, 8), truncate(hashAfter, 8))
	}
	_ = ip
	_ = mac

	return "CLEAN", ""
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func resolveEventType(op fsnotify.Op) string {
	switch {
	case op&fsnotify.Create != 0:
		return "CREATED"
	case op&fsnotify.Write != 0:
		return "MODIFIED"
	case op&fsnotify.Remove != 0:
		return "DELETED"
	case op&fsnotify.Rename != 0:
		return "DELETED"
	case op&fsnotify.Chmod != 0:
		return "PERMISSION_CHANGE"
	}
	return ""
}

func hashFile(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return ""
	}
	return hex.EncodeToString(h.Sum(nil))
}

func currentUser() string {
	out, err := exec.Command("whoami").Output()
	if err != nil {
		return "unknown"
	}
	raw := strings.TrimSpace(string(out))
	if idx := strings.LastIndex(raw, "\\"); idx >= 0 {
		return raw[idx+1:]
	}
	return raw
}

func networkInfo() (ip string, mac string) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "0.0.0.0", "00:00:00:00:00:00"
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		if len(iface.HardwareAddr) == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ipStr string
			switch v := addr.(type) {
			case *net.IPNet:
				ipStr = v.IP.String()
			case *net.IPAddr:
				ipStr = v.IP.String()
			}
			if ipStr != "" && !strings.HasPrefix(ipStr, "127.") && !strings.Contains(ipStr, ":") {
				return ipStr, iface.HardwareAddr.String()
			}
		}
	}
	return "0.0.0.0", "00:00:00:00:00:00"
}

func signEvent(fe FileEvent, key string) string {
	// Canonical JSON — deterministic field order
	canonical, _ := json.Marshal(map[string]interface{}{
		"tenantId":      fe.TenantID,
		"resourcePath":  fe.ResourcePath,
		"eventType":     fe.EventType,
		"actorUsername": fe.ActorUsername,
		"actorIp":       fe.ActorIP,
		"actorMac":      fe.ActorMAC,
		"hashBefore":    fe.HashBefore,
		"hashAfter":     fe.HashAfter,
		"hashChanged":   fe.HashChanged,
		"integrityFlag": fe.IntegrityFlag,
		"flagReason":    fe.FlagReason,
		"occurredAt":    fe.OccurredAt.Format(time.RFC3339Nano),
	})
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write(canonical)
	return hex.EncodeToString(mac.Sum(nil))
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
