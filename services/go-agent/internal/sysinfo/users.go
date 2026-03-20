// Package sysinfo detects Windows OS users and the currently logged-in user.
package sysinfo

import (
	"os/exec"
	"strings"
)

// WindowsUser represents a local Windows user account.
type WindowsUser struct {
	Username string `json:"username"`
	Status   string `json:"status"` // "OK" = active
}

// GetWindowsUsers returns all local Windows user accounts via wmic.
func GetWindowsUsers() ([]WindowsUser, error) {
	out, err := exec.Command("wmic", "useraccount", "get", "name,status").Output()
	if err != nil {
		return nil, err
	}

	var users []WindowsUser
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Name") {
			continue
		}
		// wmic output: columns are fixed-width; split on 2+ spaces
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		// Last field is Status, everything before is Name
		status := parts[len(parts)-1]
		username := strings.Join(parts[:len(parts)-1], " ")
		users = append(users, WindowsUser{
			Username: username,
			Status:   status,
		})
	}
	return users, nil
}

// GetCurrentUser returns the currently logged-in Windows username via whoami.
func GetCurrentUser() (string, error) {
	out, err := exec.Command("whoami").Output()
	if err != nil {
		return "", err
	}
	// whoami returns DOMAIN\username or HOSTNAME\username — strip domain prefix
	raw := strings.TrimSpace(string(out))
	if idx := strings.LastIndex(raw, "\\"); idx >= 0 {
		return raw[idx+1:], nil
	}
	return raw, nil
}
