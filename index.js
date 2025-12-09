const WebSocket = require('ws')
const server = new WebSocket.Server({port: process.env.PORT || "8080"})

let queue = []

console.log("Server started")

server.on("connection", socket =>
{
	socket.id = queue.length

	console.log("Socket connected:", socket.id)
	
	queue.push(socket)
	
	socket.on("message", (data) => handle_message(socket, data))

	socket.on("close", () =>
	{
		console.log("Socket disconnected:", socket.id)
		queue.splice(queue.indexOf(socket), 1)
	})

	if (queue.length == 2)
	{
		socket.send(JSON.stringify({"type": "create_offer"}))
	}
})

function handle_message(socket, data)
{
	if (queue.length < 2) { throw "Not enough sockets to begin exchange" }
	for (other of queue)
	{
		if (other === socket) { continue }
		console.log(socket.id, "sent", JSON.parse(data.toString("utf-8"))["type"], "to", other.id)
		other.send(data)
	}
}
