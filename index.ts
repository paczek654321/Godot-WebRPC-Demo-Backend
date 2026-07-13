import { IncomingMessage } from "node:http"
import { WebSocket, WebSocketServer } from "ws"

const wss = new WebSocketServer(
{
	port: Number(process.env.PORT) || 8080,
})

type Lobby =
{
	Sockets: WebSocket[]
	NextID: number
}

const lobbies: Record<string, Lobby> = {}

console.log("WebSocket server started")

wss.on("connection", handle_connect)

function handle_connect(socket: WebSocket, request: IncomingMessage)
{
	const url = new URL(request.url ?? "", `http://${request.headers.host}`)
	let code = url.searchParams.get("code")
	let playerID = 1

	if (code == null)
	{
		code = generate_code(4)
		lobbies[code] = {Sockets: [], NextID: 2}
		console.log(`Creating a new lobby (${code})`)
	}
	else
	{
		if (!(code in lobbies))
		{
			socket.close()
			console.log("New connection provided an invalid lobby code, disconnecting.")
			return	
		}
		playerID = lobbies[code].NextID++
		console.log(`Player (${playerID}) joined lobby: ${code}.`)
	}

	lobbies[code].Sockets.push(socket)

	socket.on("message", m => handle_message(socket, code, playerID, m))
	socket.on("close", () => handle_disconnect(socket, code, playerID))

	socket.send(JSON.stringify(
	{
		type: "init",
		code: code,
		id: playerID
	}))
}

function handle_disconnect(socket: WebSocket, code: string, playerID: number)
{
	lobbies[code]?.Sockets.splice(playerID, 1)
	if (playerID == 0)
	{
		lobbies[code].Sockets.forEach(socket => socket.close());
		delete lobbies[code]
		console.log(`Host of ${code} disconnected, closing the lobby.`)
	}
	else
	{
		console.log(`Player (${code}: ${playerID}) disconnected`)
	}
}

function handle_message(socket: WebSocket, code: string, playerIDX: number, data: WebSocket.RawData)
{
	console.log(`Player (${code}: ${playerIDX}) sent:`, JSON.stringify(JSON.parse(data.toString()), null, 2))
	lobbies[code].Sockets.forEach(target =>
	{
		if (target !== socket) { target.send(data) }
	});
}

function generate_code(length: number): string
{
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

  while (true)
	{
		let code = ""

		for (let i = 0; i < length; i++)
		{
			code += chars[Math.floor(Math.random() * chars.length)]
		}

		if (!(code in lobbies))
		{
			return code
		}
	}
}	