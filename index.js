const Util = require("./util.js")
const WebSocket = require('ws')
const server = new WebSocket.Server({port: process.env.PORT || "8080"})

let sockets = {}
let queue = {}

console.log("Server started")

server.on("connection", socket =>
{
	Util.set_socket_id(socket, performance.now())
	console.log("Socket connected:", socket.id)
	
	socket.on("message", (data) => handle_message(socket, data))

	socket.on("close", () => handle_disconnect(socket))

	Util.send(socket, "request_code")
})

function handle_disconnect(socket)
{
	console.log("Socket disconnected:", socket.id)
	if (socket.id in sockets)
	{
		delete sockets[socket.id]
	}
	if (socket.id in queue)
	{
		delete queue[socket.id]
	}
}

function handle_code(socket, code)
{
	console.log("Code recieved", code, "from", socket.id)

	if (String(code) in sockets)
	{
		queue[code].push(socket)

		Util.send(sockets[code], "join_request")
	}
	else if (code == -1)
	{
		code = Util.generate_code(sockets)
		
		Util.set_socket_id(socket, code)
		queue[code] = []
		sockets[code] = socket

		Util.send(socket, "lobby_created", code)
	}
	else
	{
		Util.send(socket, "err_invalid_code")
	}
}

function handle_socket_id(socket, id)
{
	console.log("Socket ID recieved", id, "from", socket.id)
	sockets[id] = queue[socket.id].shift()

	if (sockets[id].readyState !== WebSocket.OPEN)
	{
		delete sockets[id]
		Util.send(socket, "err_socket_abandoned_lobby", [], id)
		return
	}

	Util.set_socket_id(sockets[id], id)

	Util.send(sockets[id], "lobby_joined", [id])
}

function handle_full_lobby(socket, id)
{
	console.log("Error lobby full recieved", id, "from", socket.id)
	sockets[id] = queue[socket.id].shift()
	if (sockets[id].readyState == WebSocket.OPEN)
	{
		Util.send(sockets[id], "err_max_player_count_exceeded")
	}
	delete sockets[id]
}

function handle_message_redirect(socket, message)
{
	if (socket.id.slice(-4) !== message["id"].slice(-4))
	{
		socket.close()
		return
	}
	if (!(message["id"] in sockets))
	{
		Util.send(socket, "err_socket_abandoned_lobby", [], message["id"])
		return
	}
	Util.send(sockets[message["id"]], message["type"], message["payload"], socket.id)
}

function handle_message(socket, data)
{
	let message = JSON.parse(data.toString("utf-8"))
	switch(message["type"])
	{
		case "code":
			handle_code(socket, message["payload"])
			break
		case "register_socket_id":
			handle_socket_id(socket, message["payload"])
			break
		case "err_max_player_count_exceeded":
			handle_full_lobby(socket, message["payload"])
			break
		default:
			handle_message_redirect(socket, message)
	}
}