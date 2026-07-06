package invoice

func Total(cents int) int {
	if cents < 0 {
		return 0
	}

	return cents
}
