package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"chat-gobelin-api/internal/users"
	"chat-gobelin-api/internal/channels"
	"chat-gobelin-api/internal/messages"
)

type messageHandler struct {
	messageRepo messages.Repo
}

func NewMessageHandler(s messages.Repo) (*messageHandler, error) {
	return &messageHandler{
		messageRepo: s,
	}, nil
}

type createMessageRequest struct {
	Content string `json:"content" binding:"required"`
	Channel int64 `json:"channel" binding:"required"`
}

func (h messageHandler) GetMessages(writer http.ResponseWriter, request *http.Request) {
	ctx := request.Context()

	channelIDString := request.URL.Query().Get("channel")
	if channelIDString == "" {
		log.Printf("No channel found: %s", request.URL.RawQuery)
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	channelID, err := strconv.ParseInt(channelIDString, 10, 64)
	if err != nil {
		log.Printf("Error converting channel ID: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	channel := channels.Channel{
		ID: channelID,
	}

	messages, err := h.messageRepo.GetByChannel(ctx, channel)
	if err != nil {
		log.Printf("Error getting messages: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	result, err := json.Marshal(messages)
	if err != nil {
		log.Printf("Error marshaling value: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	writer.WriteHeader(http.StatusOK)
	writer.Write(result)
}

func (h messageHandler) CreateMessage(writer http.ResponseWriter, request *http.Request) {
	ctx := request.Context()

	userRaw := ctx.Value("user")
	user := userRaw.(*users.User)
	if user == nil {
		log.Printf("No user found")
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(request.Body)

	var req createMessageRequest
	err := decoder.Decode(&req)

	if err != nil {
		log.Printf("Error decoding request: %s", err)
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	//TODO: validation
	channel := channels.Channel{
		ID: req.Channel,
	}

	messages, err := h.messageRepo.Create(ctx, req.Content, channel, *user)
	if err != nil {
		log.Printf("Error creating message: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	result, err := json.Marshal(messages)
	if err != nil {
		log.Printf("Error marshaling value: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	writer.WriteHeader(http.StatusOK)
	writer.Write(result)
}
