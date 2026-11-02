CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ON users(username);

CREATE TABLE IF NOT EXISTS channels (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ON channels(name);

CREATE TABLE IF NOT EXISTS user_channels (
    user_id BIGSERIAL NOT NULL,
    channel_id BIGSERIAL NOT NULL
);

CREATE INDEX on user_channels(user_id);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGSERIAL NOT NULL,
    channel_id BIGSERIAL NOT NULL,
    content TEXT NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ON messages(channel_id);
