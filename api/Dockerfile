FROM golang

WORKDIR /app

# COPY go.mod go.sum ./

# RUN go mod download

# COPY . .

RUN go install github.com/air-verse/air@latest

EXPOSE 4000

CMD air
