const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const app=express(), server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});
app.use(express.static(path.join(__dirname,"public")));
const rooms=new Map();

function clean(s,max=24){return String(s??"").trim().slice(0,max)}
function roomInfo(r){
  return {code:r.code,name:r.name,hostId:r.hostId,
    players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,host:p.id===r.hostId}))};
}
function sendRooms(){
  io.emit("rooms",[...rooms.values()].map(r=>({code:r.code,name:r.name,count:r.players.size,locked:!!r.password})));
}
function lobby(r){io.to(r.code).emit("lobby",roomInfo(r));sendRooms()}

io.on("connection",socket=>{
  socket.on("getRooms",()=>socket.emit("rooms",[...rooms.values()].map(r=>({code:r.code,name:r.name,count:r.players.size,locked:!!r.password}))));
  socket.on("createRoom",(d,cb)=>{
    d=d||{}; let code=clean(d.code,10).toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!code) code=Math.random().toString(36).slice(2,8).toUpperCase();
    if(rooms.has(code)) return cb?.({ok:false,error:"Room code already exists"});
    const r={code,name:clean(d.roomName)||"Off-Road Race",password:clean(d.password,30),hostId:socket.id,started:false,players:new Map()};
    r.players.set(socket.id,{id:socket.id,name:clean(d.name)||"Driver",color:clean(d.color,12)||"#ff6b35",ready:true,x:0,z:0,rot:0,speed:0});
    rooms.set(code,r); socket.join(code); socket.data.room=code; cb?.({ok:true,code}); lobby(r);
  });
  socket.on("joinRoom",(d,cb)=>{
    d=d||{}; const code=clean(d.code,10).toUpperCase(); const r=rooms.get(code);
    if(!r)return cb?.({ok:false,error:"Room not found"});
    if(r.started)return cb?.({ok:false,error:"Race already started"});
    if(r.password && r.password!==clean(d.password,30))return cb?.({ok:false,error:"Wrong password"});
    if(r.players.size>=12)return cb?.({ok:false,error:"Room is full"});
    r.players.set(socket.id,{id:socket.id,name:clean(d.name)||"Driver",color:clean(d.color,12)||"#35a7ff",ready:false,x:0,z:0,rot:0,speed:0});
    socket.join(code);socket.data.room=code;cb?.({ok:true,code});lobby(r);
  });
  socket.on("toggleReady",()=>{
    const r=rooms.get(socket.data.room); const p=r?.players.get(socket.id);
    if(p){p.ready=!p.ready;lobby(r)}
  });
  socket.on("startRace",()=>{
    const r=rooms.get(socket.data.room); if(!r||r.hostId!==socket.id)return;
    if([...r.players.values()].some(p=>!p.ready))return socket.emit("notice","Everyone must be ready.");
    r.started=true; for(const p of r.players.values()){p.x=0;p.z=0;p.rot=0;p.speed=0}
    io.to(r.code).emit("raceStarted",{players:roomInfo(r).players});
  });
  socket.on("state",s=>{
    const r=rooms.get(socket.data.room); const p=r?.players.get(socket.id);
    if(!r||!p||!r.started)return;
    p.x=Number(s.x)||0;p.z=Number(s.z)||0;p.rot=Number(s.rot)||0;p.speed=Number(s.speed)||0;
    socket.to(r.code).emit("playerState",{id:socket.id,x:p.x,z:p.z,rot:p.rot,speed:p.speed});
  });
  socket.on("leaveRoom",()=>leave(socket));
  socket.on("disconnect",()=>leave(socket));
});
function leave(socket){
 const code=socket.data.room,r=rooms.get(code); if(!r)return;
 r.players.delete(socket.id); if(r.hostId===socket.id) r.hostId=r.players.keys().next().value;
 if(!r.players.size)rooms.delete(code); else lobby(r); sendRooms();
}
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("OFFROAD X running on port "+PORT));
