package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"chat-gobelin-api/internal/users"
	"chat-gobelin-api/internal/channels"
)

type channelHandler struct {
	channelRepo channels.Repo
	userRepo users.Repo
}

func NewChannelHandler(s channels.Repo, u users.Repo) (*channelHandler, error) {
	return &channelHandler{
		channelRepo: s,
		userRepo: u,
	}, nil
}

type createChannelRequest struct {
	Name string `json:"name" binding:"required"`
}

type EnterChannelRequest struct {
	ChannelName string `json:"channel" binding:"required"`
}

func (h channelHandler) Create(writer http.ResponseWriter, request *http.Request) {
	ctx := request.Context()

	userRaw := ctx.Value("user")
	user := userRaw.(*users.User)
	if user == nil {
		log.Printf("No user found")
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(request.Body)

	var req createChannelRequest
	err := decoder.Decode(&req)

	if err != nil {
		log.Printf("Error decoding request: %s", err)
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	channel, err := h.channelRepo.Create(ctx, req.Name)
	if err != nil {
		log.Printf("Error creating channel: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	err = h.channelRepo.AddUserToChannel(ctx, *channel, *user)
	if err != nil {
		log.Printf("Error adding user to new channel: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	result, err := json.Marshal(channel)
	if err != nil {
		log.Printf("Error marshaling value: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	writer.WriteHeader(http.StatusOK)
	writer.Write(result)
}

func (h channelHandler) EnterChannel(writer http.ResponseWriter, request *http.Request) {
	ctx := request.Context()

	userRaw := ctx.Value("user")
	user := userRaw.(*users.User)
	if user == nil {
		log.Printf("No user found")
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(request.Body)

	var req EnterChannelRequest
	err := decoder.Decode(&req)

	if err != nil {
		log.Printf("Error decoding request: %s", err)
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	channel, err := h.channelRepo.GetByName(ctx, req.ChannelName)
	if err != nil {
		log.Printf("Error finding channel: %s", err)
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	err = h.channelRepo.AddUserToChannel(ctx, *channel, *user)
	if err != nil {
		log.Printf("Error adding user to new channel: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	result, err := json.Marshal(channel)
	if err != nil {
		log.Printf("Error marshaling value: %s", err.Error())
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	writer.WriteHeader(http.StatusOK)
	writer.Write(result)
}
