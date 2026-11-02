package channels

type Channel struct {
	Name string `json:"name"`
	ID int64    `json:"id"`
	CreationDate string `db:"creation_date" json:"creation_date"`
}
