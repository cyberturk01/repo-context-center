package account

func DisplayName(name string) string {
	if name == "" {
		return "unknown"
	}

	return name
}
