package users

type User struct {
	Username     string `json:"username"`
	PasswordHash []byte `json:"-" db:"password_hash"` // We never show the password hash
	ID           int64  `json:"id"`
}
