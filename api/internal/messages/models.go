package messages

import "encoding/json"

type Message struct {
	ID           int64  `json:"id"`
	Content      string `json:"content"`
	UserID       int64  `db:"user_id" json:"user_id"`
	User         string `json:"user"`
	CreationDate string `db:"creation_date" json:"creation_date"`
	RawMetadata  []byte  `db:"metadata" json:"-"`
	Metadata     map[string]json.RawMessage  `db:"-" json:"metadata"`
}
