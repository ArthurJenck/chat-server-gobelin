package messages

import (
	"context"
	"fmt"

	"chat-gobelin-api/internal/users"
	"chat-gobelin-api/internal/channels"

	"github.com/jmoiron/sqlx"
)

type Repo interface {
	GetByChannel(ctx context.Context, channel channels.Channel) ([]Message, error)
	Create(ctx context.Context, content string, channel channels.Channel, user users.User) (*Message, error)
}

type repo struct {
	db *sqlx.DB
}

func NewRepo(db *sqlx.DB) (Repo, error) {
	return &repo{
		db: db,
	}, nil
}


func (r *repo) GetByChannel(ctx context.Context, channel channels.Channel) ([]Message, error) {
	query := `SELECT
			a.id,
			a.content,
			a.user_id,
			a.creation_date,
			b.username as user
		FROM messages a
		JOIN users b ON a.user_id = b.id
		WHERE a.channel_id = ?
		ORDER BY creation_date
		LIMIT 100`

	query = r.db.Rebind(query)
	var messages []Message
	err := r.db.SelectContext(ctx, &messages, query, channel.ID)
	if err != nil {
		return messages, fmt.Errorf("Error retrieving channels: %w", err)
	}
	return messages, nil
}

func (r *repo) Create(ctx context.Context, content string, channel channels.Channel, user users.User) (*Message, error) {
	query := `INSERT INTO messages
		(content, user_id, channel_id, creation_date) VALUES (?, ?, ?, NOW())
		RETURNING id, content, user_id, creation_date`

	query = r.db.Rebind(query)
	var message Message
	err := r.db.GetContext(ctx, &message, query, content, user.ID, channel.ID)
	if err != nil {
		return nil, fmt.Errorf("Error creating channel: %w", err)
	}
	message.User = user.Username
	return &message, nil
}
