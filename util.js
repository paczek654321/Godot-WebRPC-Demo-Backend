Object.prototype.remove = function(value) { this.splice(this.indexOf(value), 1) }

module.exports.send = function(socket, type, data = "", source = "Server")
{
	if (typeof(data) !== "object") { data = data ? [data] : []}
	console.log(source, "sent", type, "to", socket.id)
	socket.send(JSON.stringify({"type": type, "payload": data, "id": source}))
}
module.exports.generate_code = function(codes)
{
	let code
	
	do { code = Math.floor(Math.random()*8999)+1000 }
	while (String(code) in codes)
	
	return code
}
module.exports.set_socket_id = function(socket, id)
{
	id = id.toString()
	if (socket.id !== undefined)
	{
		console.log("Socket", socket.id, "Registered as", id)
	}
	socket.id = id
}