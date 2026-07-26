import { IncomingMessage } from "node:http"
import { WebSocket, WebSocketServer } from "ws"

const wss = new WebSocketServer(
{
	port: Number(process.env.PORT) || 8080,
})

type Lobby =
{
	Sockets: Record<number, WebSocket>
	NextID: number
	Locked: boolean
	Version: string
}

const SystemMessage =
{
	LockLobby: 1,
	UnlockLobby: 2
}

const lobbies: Record<string, Lobby> = {}

console.log("WebSocket server started")

wss.on("connection", handle_connect)

function handle_connect(socket: WebSocket, request: IncomingMessage)
{
	const url = new URL(request.url ?? "", `http://${request.headers.host}`)
	let code = url.searchParams.get("code")
	let version = url.searchParams.get("version")
	let playerID = 1

	if (code == null)
	{
		code = generate_code(4)
		lobbies[code] = {Sockets: {}, NextID: 2, Locked: false, Version: version ?? ""}
		console.log(`Creating a new lobby (${code})`)
	}
	else
	{
		if (!(code in lobbies) || lobbies[code].Locked)
		{
			socket.close(4001, "Lobby not found")
			console.log("New connection provided an invalid lobby code, disconnecting.")
			return	
		}
		playerID = lobbies[code].NextID++
		version = lobbies[code].Version
		console.log(`Player (${playerID}) joined lobby: ${code}.`)
	}

	lobbies[code].Sockets[playerID] = socket

	socket.on("message", (m, b) => handle_message(socket, code, playerID, m, b))
	socket.on("close", () => handle_disconnect(socket, code, playerID))

	socket.send(JSON.stringify(
	{
		type: "init",
		code: code,
		version: version,
		id: playerID
	}))
}

function handle_disconnect(socket: WebSocket, code: string, playerID: number)
{
	delete lobbies[code]?.Sockets[playerID]
	if (playerID === 1)
	{
		const sockets = lobbies[code]?.Sockets ?? {}
		for (const target of Object.values(sockets))
		{
			target.close(1001, "Host abandoned lobby")
		}
		delete lobbies[code]
		console.log(`Host of ${code} disconnected, closing the lobby.`)
	}
	else
	{
		console.log(`Player (${code}: ${playerID}) disconnected`)
	}
}

function handle_message(socket: WebSocket, code: string, playerID: number, data: WebSocket.RawData, isBinary: boolean)
{
	if (isBinary)
	{
		if (Buffer.isBuffer(data))
		{
			handle_system_message(socket, code, playerID, data)
		}
	}
	else
	{
		redirect_message(socket, code, playerID, data)
	}
	
}

function handle_system_message(socket: WebSocket, code: string, playerID: number, data: Buffer)
{
	switch (data[0])
	{
		case SystemMessage.LockLobby:
			if (playerID == 1)
			{
				lobbies[code].Locked = true
			}
			break;
		case SystemMessage.UnlockLobby:
			if (playerID == 1)
			{
				lobbies[code].Locked = false
			}
			break;
	}
}

function redirect_message(socket: WebSocket, code: string, playerID: number, data: WebSocket.RawData)
{
	console.log(`Player (${code}: ${playerID}) sent:`, JSON.stringify(JSON.parse(data.toString()), null, 2))

	const sockets = lobbies[code]?.Sockets ?? {}

	for (const target of Object.values(sockets))
	{
		if (target !== socket && target.readyState === WebSocket.OPEN)
		{
			target.send(data)
		}
	}
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