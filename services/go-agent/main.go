// SecureWatch Go Agent
// Monitors a directory for file system events, detects Windows users,
// syncs them to the REST API, and publishes signed file events to Kafka.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/securewatch/go-agent/internal/sysinfo"
	"github.com/securewatch/go-agent/internal/watcher"

	"github.com/segmentio/kafka-go"
)

func main() {
	monitoredPath := getenv("MONITORED_PATH", `C:\SecureWatch\monitored`)
	hmacKey       := getenv("AGENT_HMAC_KEY", "change-me")
	apiBaseURL    := getenv("API_BASE_URL", "http://localhost:3001")
	kafkaBrokers  := strings.Split(getenv("KAFKA_BROKERS", "127.0.0.1:9092"), ",")
	tenantID      := getenv("TENANT_ID", "00000000-0000-0000-0000-000000000001")

	// ── Sync Windows users to API on startup ─────────────────────────────────
	if err := syncUsers(apiBaseURL, tenantID); err != nil {
		fmt.Fprintf(os.Stderr, "[agent] user sync failed: %v\n", err)
	}

	// ── Fetch approved users from API ─────────────────────────────────────────
	approved := fetchApprovedUsers(apiBaseURL)

	cfg := watcher.Config{
		MonitoredPath: monitoredPath,
		TenantID:      tenantID,
		HMACKey:       hmacKey,
		KafkaBrokers:  kafkaBrokers,
		APIBaseURL:    apiBaseURL,
		ApprovedUsers: approved,
	}

	w := watcher.New(cfg)

	// Refresh approved users every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			users := fetchApprovedUsers(apiBaseURL)
			w.UpdateApprovedUsers(users)
		}
	}()

	// ── Kafka writer ──────────────────────────────────────────────────────────
	writer := &kafka.Writer{
		Addr:     kafka.TCP(kafkaBrokers...),
		Topic:    "securewatch.file-events",
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	publish := func(fe watcher.FileEvent) error {
		payload, err := json.Marshal(fe)
		if err != nil {
			return err
		}
		return writer.WriteMessages(context.Background(), kafka.Message{
			Key:   []byte(fe.ResourcePath),
			Value: payload,
		})
	}

	fmt.Printf("[agent] Starting SecureWatch Go Agent\n")
	fmt.Printf("[agent] Monitored path: %s\n", monitoredPath)
	fmt.Printf("[agent] Kafka brokers: %v\n", kafkaBrokers)

	if err := w.Start(publish); err != nil {
		fmt.Fprintf(os.Stderr, "[agent] watcher error: %v\n", err)
		os.Exit(1)
	}
}

// ── User sync ─────────────────────────────────────────────────────────────────

type syncUsersBody struct {
	Users       []sysinfo.WindowsUser `json:"users"`
	CurrentUser string                `json:"currentUser"`
	Hostname    string                `json:"hostname"`
}

func syncUsers(apiBaseURL, tenantID string) error {
	users, err := sysinfo.GetWindowsUsers()
	if err != nil {
		return fmt.Errorf("GetWindowsUsers: %w", err)
	}
	currentUser, err := sysinfo.GetCurrentUser()
	if err != nil {
		currentUser = "unknown"
	}
	hostname, _ := os.Hostname()

	body := syncUsersBody{Users: users, CurrentUser: currentUser, Hostname: hostname}
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		apiBaseURL+"/api/v1/agent/sync-users",
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("sync-users returned %d", resp.StatusCode)
	}
	fmt.Printf("[agent] Synced %d Windows users (current: %s)\n", len(users), currentUser)
	return nil
}

func fetchApprovedUsers(apiBaseURL string) []string {
	resp, err := http.Get(apiBaseURL + "/api/v1/agent/approved-users")
	if err != nil {
		fmt.Fprintf(os.Stderr, "[agent] fetchApprovedUsers: %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Usernames []string `json:"usernames"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}
	return result.Usernames
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
