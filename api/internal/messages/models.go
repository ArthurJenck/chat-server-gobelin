package messages

type Message struct {
	ID           int64  `json:"-"`
	Content      string `json:"content"`
	UserID       int64  `db:"user_id" json:"user_id"`
	User         string `json:"user"`
	CreationDate string `db:"creation_date" json:"creation_date"`
}
