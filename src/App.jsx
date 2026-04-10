import { useState, useEffect, useRef, useCallback } from "react";

const MU=0.012150585,EARTH_X=-MU,MOON_X=1-MU,R_LEO=(6371+185)/384400,R_EARTH=6371/384400,R_MOON_NORM=1737/384400,V_CIRC=Math.sqrt((1-MU)/R_LEO),KM=384400,SIM_DT=0.00005,PLAYBACK_DT=0.004;

function derivs([x,y,vx,vy],mo){const x1=x+MU,x2=x-(1-MU),r1=Math.sqrt(x1*x1+y*y),r2=Math.sqrt(x2*x2+y*y),mt=mo?MU:0;return[vx,vy,2*vy+x-(1-MU)*x1/r1**3-mt*x2/r2**3,-2*vx+y-(1-MU)*y/r1**3-mt*y/r2**3];}
function rk4(s,dt,mo){const k1=derivs(s,mo),k2=derivs(s.map((v,i)=>v+.5*dt*k1[i]),mo),k3=derivs(s.map((v,i)=>v+.5*dt*k2[i]),mo),k4=derivs(s.map((v,i)=>v+dt*k3[i]),mo);return s.map((v,i)=>v+(dt/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));}
function simulate(speed,angleDeg,moonOn,endless=false){const rad=angleDeg*Math.PI/180;let st=[EARTH_X+R_LEO,0,speed*Math.sin(rad),speed*Math.cos(rad)];const pts=[{x:st[0],y:st[1],t:0,vx:st[2],vy:st[3]}];let minMD=999,time=0,endReason="timeout";const maxSteps=endless?3000000:800000;const sampleEvery=endless?120:40;for(let i=0;i<maxSteps;i++){st=rk4(st,SIM_DT,moonOn);time+=SIM_DT;const rm=Math.sqrt((st[0]-MOON_X)**2+st[1]**2);if(rm<minMD)minMD=rm;if(moonOn&&rm<R_MOON_NORM){pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});endReason="moon_collision";break;}const re=Math.sqrt((st[0]-EARTH_X)**2+st[1]**2);if(i>500&&re<R_EARTH){pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});endReason="earth_collision";break;}if(!endless&&(Math.abs(st[0])>4||Math.abs(st[1])>4)){pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});endReason="escape";break;}if(i%sampleEvery===0)pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});}return{pts,minMD,totalTime:time,endReason};}
function toI(x,y,t){const c=Math.cos(t),s=Math.sin(t);return{x:x*c-y*s,y:x*s+y*c};}
function dvKmps(s){return((s-V_CIRC)*V_SCALE).toFixed(3);}
const V_SCALE=7.79/V_CIRC;
function simH(t){return t*104.3;}
const END_LABELS={earth_collision:"地球到着",moon_collision:"月面衝突",escape:"脱出",timeout:"時間切れ"};

const FONT="'DM Sans','Noto Sans JP',system-ui,sans-serif";
const card={background:"#fff",border:"1px solid #e0e4ea",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"};
const numInput={background:"#f5f7fa",border:"1px solid #d0d6e0",borderRadius:6,fontSize:16,fontWeight:700,fontFamily:"'DM Mono',monospace",fontVariantNumeric:"tabular-nums",padding:"6px 10px",width:110,textAlign:"right",outline:"none",color:"#1a3050"};
const btnBase={fontFamily:FONT,fontWeight:600,cursor:"pointer",borderRadius:8,transition:"all 0.2s"};

function drawMainCanvas(ctx,W,H,res,simTime,frameMode,angle,moonOn,zoom,pan){
  const isIn=frameMode==="inertial";
  const visible=[];for(const p of res.pts){if(p.t<=simTime)visible.push(p);else break;}
  // Bounding box: always use normal-mode range (Earth-Moon system ± margin)
  // so the initial zoom level is consistent regardless of endless mode.
  // Users can zoom out manually to see the full trajectory.
  let bx0=0,bx1=0,by0=0,by1=0;
  const BBOX_LIMIT=2.5; // max extent in normalized units (~960,000 km)
  if(isIn){
    bx0=-1.15;bx1=1.15;by0=-1.15;by1=1.15;
    for(const p of res.pts){const pi=toI(p.x,p.y,p.t),ei=toI(EARTH_X,0,p.t);const wx=pi.x-ei.x,wy=pi.y-ei.y;if(wx<bx0)bx0=Math.max(wx,-BBOX_LIMIT);if(wx>bx1)bx1=Math.min(wx,BBOX_LIMIT);if(wy<by0)by0=Math.max(wy,-BBOX_LIMIT);if(wy>by1)by1=Math.min(wy,BBOX_LIMIT);}
  }else{
    bx0=Math.min(0,EARTH_X,MOON_X);bx1=Math.max(0,EARTH_X,MOON_X);by0=0;by1=0;
    for(const p of res.pts){const cx=Math.max(-BBOX_LIMIT,Math.min(BBOX_LIMIT,p.x));const cy=Math.max(-BBOX_LIMIT,Math.min(BBOX_LIMIT,p.y));if(cx<bx0)bx0=cx;if(cx>bx1)bx1=cx;if(cy<by0)by0=cy;if(cy>by1)by1=cy;}
  }
  const rX=bx1-bx0||1,rY=by1-by0||1,cX=(bx0+bx1)/2,cY=(by0+by1)/2;
  const baseSc=Math.min(W,H)*.64/Math.max(rX,rY),sc=baseSc*zoom;
  const ccx=W/2-cX*sc+pan.ox,ccy=H/2+cY*sc+pan.oy;

  // Black background
  ctx.fillStyle="#04040e";ctx.fillRect(0,0,W,H);
  // Stars
  const rng2=s=>{let h=s|0;return()=>{h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>13),0x45d9f3b);return((h^(h>>>16))>>>0)/4294967296;};};
  const rand=rng2(77);for(let i=0;i<150;i++){ctx.fillStyle=`rgba(180,200,240,${.08+rand()*.2})`;ctx.fillRect(rand()*W,rand()*H,rand()>.92?1.3:.6,.6);}

  const ts=(wx,wy)=>[ccx+wx*sc,ccy-wy*sc];
  const[ex,ey]=isIn?ts(0,0):ts(EARTH_X,0);
  let mx,my;if(isIn){const mI2=toI(MOON_X,0,simTime),eI2=toI(EARTH_X,0,simTime);[mx,my]=ts(mI2.x-eI2.x,mI2.y-eI2.y);}else{[mx,my]=ts(MOON_X,0);}

  // Moon orbit / axis
  if(isIn){
    // Moon orbit circle
    ctx.strokeStyle="rgba(200,190,160,0.3)";ctx.lineWidth=1.2;ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(ex,ey,sc,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    // Moon trail arc
    ctx.strokeStyle="rgba(200,190,160,0.15)";ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=200;i++){const t2=(i/200)*simTime,m2=toI(MOON_X,0,t2),e2=toI(EARTH_X,0,t2),[sx2,sy2]=ts(m2.x-e2.x,m2.y-e2.y);i===0?ctx.moveTo(sx2,sy2):ctx.lineTo(sx2,sy2);}ctx.stroke();
  } else {
    // Earth–Moon axis
    ctx.strokeStyle="rgba(140,160,200,0.2)";ctx.lineWidth=1;ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(mx,my);ctx.stroke();ctx.setLineDash([]);
  }

  // L1
  if(!isIn){const rH2=Math.cbrt(MU/3),[l1x,l1y]=ts(1-MU-rH2,0);ctx.fillStyle="rgba(255,210,100,0.35)";ctx.beginPath();ctx.arc(l1x,l1y,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,210,100,0.5)";ctx.font="600 11px system-ui";ctx.textAlign="center";ctx.fillText("L₁",l1x,l1y-8);}

  // Earth
  const eR=Math.max(R_EARTH*sc,6);
  const eg=ctx.createRadialGradient(ex-eR*.2,ey-eR*.2,eR*.1,ex,ey,eR);eg.addColorStop(0,"#5ab8f0");eg.addColorStop(.4,"#2d8cc4");eg.addColorStop(1,"#1a5a8a");
  ctx.beginPath();ctx.arc(ex,ey,eR,0,Math.PI*2);ctx.fillStyle=eg;ctx.fill();
  // Atmosphere
  const atm=ctx.createRadialGradient(ex,ey,eR,ex,ey,eR+8);atm.addColorStop(0,"rgba(60,150,255,0.25)");atm.addColorStop(1,"rgba(60,150,255,0)");ctx.beginPath();ctx.arc(ex,ey,eR+8,0,Math.PI*2);ctx.fillStyle=atm;ctx.fill();
  // LEO ring
  const leoR=R_LEO*sc;if(leoR>8){ctx.strokeStyle="rgba(100,200,255,0.15)";ctx.lineWidth=.8;ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(ex,ey,leoR,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  // Earth label
  ctx.fillStyle="rgba(140,190,240,0.7)";ctx.font="700 14px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("地球",ex,ey+eR+18);

  // Moon
  if(moonOn){
    const mR=Math.max(R_MOON_NORM*sc,4);
    const mgr=ctx.createRadialGradient(mx-mR*.2,my-mR*.2,mR*.05,mx,my,mR);mgr.addColorStop(0,"#e8e4d8");mgr.addColorStop(.5,"#b8b0a0");mgr.addColorStop(1,"#807868");
    ctx.beginPath();ctx.arc(mx,my,mR,0,Math.PI*2);ctx.fillStyle=mgr;ctx.fill();
    ctx.strokeStyle="rgba(200,190,170,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(mx,my,mR,0,Math.PI*2);ctx.stroke();
    // Moon label
    ctx.fillStyle="rgba(210,200,180,0.7)";ctx.font="700 14px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("月",mx,my+mR+18);
  }

  // Launch arrow
  if(!isIn&&visible.length<5){const[lpx,lpy]=ts(EARTH_X+R_LEO,0),aL=28,rd=angle*Math.PI/180,adx=Math.sin(rd)*aL,ady=-Math.cos(rd)*aL;ctx.strokeStyle="rgba(255,180,60,0.7)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lpx,lpy);ctx.lineTo(lpx+adx,lpy+ady);ctx.stroke();const hl=7,aa=Math.atan2(ady,adx);ctx.beginPath();ctx.moveTo(lpx+adx,lpy+ady);ctx.lineTo(lpx+adx-hl*Math.cos(aa-.4),lpy+ady-hl*Math.sin(aa-.4));ctx.moveTo(lpx+adx,lpy+ady);ctx.lineTo(lpx+adx-hl*Math.cos(aa+.4),lpy+ady-hl*Math.sin(aa+.4));ctx.stroke();}

  // Trajectory — much bolder colors on white
  if(visible.length>1){for(let i=1;i<visible.length;i++){const tF=visible[i].t/res.totalTime,p=visible[i],pp=visible[i-1];let sx,sy,px2,py2;if(isIn){const pi=toI(p.x,p.y,p.t),ei=toI(EARTH_X,0,p.t);[sx,sy]=ts(pi.x-ei.x,pi.y-ei.y);const ppi=toI(pp.x,pp.y,pp.t),epi=toI(EARTH_X,0,pp.t);[px2,py2]=ts(ppi.x-epi.x,ppi.y-epi.y);}else{[sx,sy]=ts(p.x,p.y);[px2,py2]=ts(pp.x,pp.y);}
    const md=Math.sqrt((p.x-MOON_X)**2+p.y**2),nm=Math.max(0,Math.min(1,1-md*2.5));
    const r=Math.round(40+nm*215),g=Math.round(160+nm*90-nm*nm*100),b=Math.round(255-nm*200);
    const alpha=0.2+tF*0.8;
    ctx.strokeStyle=`rgba(${r},${g},${b},${alpha})`;ctx.lineWidth=1.5+tF*1.5;ctx.beginPath();ctx.moveTo(px2,py2);ctx.lineTo(sx,sy);ctx.stroke();}
  // Spacecraft dot
  const last=visible[visible.length-1];let lx,ly;if(isIn){const li=toI(last.x,last.y,last.t),lei=toI(EARTH_X,0,last.t);[lx,ly]=ts(li.x-lei.x,li.y-lei.y);}else{[lx,ly]=ts(last.x,last.y);}
  const glow=ctx.createRadialGradient(lx,ly,0,lx,ly,14);glow.addColorStop(0,"rgba(100,200,255,0.8)");glow.addColorStop(.4,"rgba(100,200,255,0.15)");glow.addColorStop(1,"rgba(100,200,255,0)");
  ctx.beginPath();ctx.arc(lx,ly,14,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();
  ctx.beginPath();ctx.arc(lx,ly,3,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();}

  // End reason
  if(simTime>=res.totalTime&&res.endReason!=="timeout"){const lb=END_LABELS[res.endReason]||res.endReason;const isC=res.endReason==="earth_collision"||res.endReason==="moon_collision";const last2=res.pts[res.pts.length-1];let fx,fy;if(isIn){const fi=toI(last2.x,last2.y,last2.t),fei=toI(EARTH_X,0,last2.t);[fx,fy]=ts(fi.x-fei.x,fi.y-fei.y);}else{[fx,fy]=ts(last2.x,last2.y);}
  if(isC){ctx.beginPath();ctx.arc(fx,fy,20,0,Math.PI*2);const boom=ctx.createRadialGradient(fx,fy,0,fx,fy,20);boom.addColorStop(0,"rgba(255,180,30,0.8)");boom.addColorStop(.5,"rgba(255,80,20,0.3)");boom.addColorStop(1,"rgba(255,40,10,0)");ctx.fillStyle=boom;ctx.fill();}
  ctx.fillStyle=isC?"rgba(255,120,80,0.9)":"rgba(120,200,255,0.8)";ctx.font="700 14px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(lb,fx,fy-24);}

  // Frame label
  ctx.fillStyle="rgba(140,170,210,0.35)";ctx.font="600 12px system-ui,sans-serif";ctx.textAlign="left";ctx.fillText(isIn?"慣性座標系":"回転座標系",10,H-10);

  // Elapsed time
  const hours=simH(simTime),days=Math.floor(hours/24),hrs=Math.floor(hours%24);
  const hrsStr=String(hrs).padStart(2,'0');const timeStr=days>0?`${days}日 ${hrsStr}時間`:`${hrsStr}時間`;
  ctx.save();ctx.font="600 20px system-ui,sans-serif";const tw2=ctx.measureText(timeStr).width;
  const px=W-tw2-20,py=8,ph=32,pw=tw2+14;
  ctx.fillStyle="rgba(6,6,16,0.75)";ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.fill();
  ctx.strokeStyle="rgba(100,160,220,0.15)";ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.stroke();
  ctx.fillStyle="rgba(170,210,255,0.9)";ctx.font="600 20px system-ui,sans-serif";ctx.textAlign="right";ctx.fillText(timeStr,px+pw-7,py+23);ctx.restore();
}

export default function App(){
  const canvasRef=useRef(null);
  const[speed,setSpeed]=useState(10.6826);const[angle,setAngle]=useState(0);const[moonOn,setMoonOn]=useState(true);
  const[res,setRes]=useState(null);const[simTime,setSimTime]=useState(0);const[running,setRunning]=useState(false);
  const[frame,setFrame]=useState("inertial");const[playbackSpeed,setPlaybackSpeed]=useState(1);const[zoom,setZoom]=useState(1);
  const af=useRef(null);const stopRef=useRef(false);const panRef=useRef({ox:0,oy:0});const[panTick,setPanTick]=useState(0);const dragRef=useRef(null);
  const[speedStr,setSpeedStr]=useState((10.6826*V_SCALE).toFixed(3));const[angleStr,setAngleStr]=useState("0.0");const playbackRef=useRef(1);
  const[recording,setRecording]=useState(false);const[recordProgress,setRecordProgress]=useState(0);
  const[showHelp,setShowHelp]=useState(false);
  const[endless,setEndless]=useState(false);
  useEffect(()=>{playbackRef.current=playbackSpeed;},[playbackSpeed]);

  const go=useCallback((s,a,m,el)=>{stopRef.current=true;if(af.current){cancelAnimationFrame(af.current);af.current=null;}const r=simulate(s,a,m,el);setRes(r);setSimTime(0);stopRef.current=false;setRunning(true);},[]);
  const stop=useCallback(()=>{stopRef.current=true;if(af.current){cancelAnimationFrame(af.current);af.current=null;}setRunning(false);},[]);
  useEffect(()=>{go(speed,angle,moonOn,endless);},[]);
  useEffect(()=>{if(!running||!res)return;stopRef.current=false;let cur=simTime;const tick=()=>{if(stopRef.current)return;cur+=PLAYBACK_DT*playbackRef.current;if(cur>=res.totalTime){cur=res.totalTime;setSimTime(cur);setRunning(false);return;}setSimTime(cur);af.current=requestAnimationFrame(tick);};af.current=requestAnimationFrame(tick);return()=>{if(af.current){cancelAnimationFrame(af.current);af.current=null;}};},[running,res]);

  const handlePointerDown=(e)=>{if(e.button!==0)return;const cvs=canvasRef.current;if(!cvs)return;cvs.setPointerCapture(e.pointerId);const c=panRef.current;dragRef.current={sx:e.clientX,sy:e.clientY,sox:c.ox,soy:c.oy};};
  const handlePointerMove=(e)=>{if(!dragRef.current)return;panRef.current={ox:dragRef.current.sox+(e.clientX-dragRef.current.sx),oy:dragRef.current.soy+(e.clientY-dragRef.current.sy)};setPanTick(t=>t+1);};
  const handlePointerUp=()=>{dragRef.current=null;};
  const resetView=()=>{panRef.current={ox:0,oy:0};setZoom(1);setPanTick(t=>t+1);};
  const updateSpeed=(v)=>{setSpeed(v);setSpeedStr((v*V_SCALE).toFixed(3));};const updateAngle=(v)=>{setAngle(v);setAngleStr(v.toFixed(1));};
  const commitSpeed=(str)=>{const kmps=parseFloat(str);if(!isNaN(kmps)&&kmps>=1&&kmps<=20){const internal=kmps/V_SCALE;setSpeed(internal);setSpeedStr(kmps.toString());}else{setSpeedStr((speed*V_SCALE).toFixed(3));}};
  const commitAngle=(str)=>{const v=parseFloat(str);if(!isNaN(v)&&v>=-360&&v<=360){setAngle(v);setAngleStr(v.toString());}else{setAngleStr(angle.toFixed(1));}};

  const startRecording=useCallback(()=>{
    if(!res||recording)return;setRecording(true);setRecordProgress(0);stop();
    const rc=document.createElement('canvas');rc.width=600;rc.height=600;const rctx=rc.getContext('2d');
    const stream=rc.captureStream(30);const chunks=[];
    const mt=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
    const rec=new MediaRecorder(stream,{mimeType:mt,videoBitsPerSecond:4000000});
    rec.ondataavailable=(e)=>{if(e.data.size>0)chunks.push(e.data);};
    rec.onstop=()=>{const blob=new Blob(chunks,{type:mt});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='free_return_trajectory.webm';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);setRecording(false);setRecordProgress(0);};
    rec.start();const recDt=PLAYBACK_DT*playbackSpeed;const totalFrames=Math.ceil(res.totalTime/recDt);let fi=0;
    const pn={...panRef.current},cz=zoom,cf=frame,ca=angle,cm=moonOn;
    const next=()=>{if(fi>totalFrames){setTimeout(()=>{rec.stop();},100);return;}const t=Math.min(fi*recDt,res.totalTime);drawMainCanvas(rctx,600,600,res,t,cf,ca,cm,cz,pn);setSimTime(t);setRecordProgress(Math.round((fi/totalFrames)*100));fi++;requestAnimationFrame(next);};
    setTimeout(next,200);
  },[res,recording,zoom,frame,angle,moonOn,playbackSpeed,stop]);

  useEffect(()=>{const cvs=canvasRef.current;if(!cvs||!res)return;const pan=panRef.current;const dpr=window.devicePixelRatio||1;const dW=cvs.clientWidth,dH=cvs.clientHeight;cvs.width=dW*dpr;cvs.height=dH*dpr;const ctx=cvs.getContext("2d");ctx.scale(dpr,dpr);drawMainCanvas(ctx,dW,dH,res,simTime,frame,angle,moonOn,zoom,pan);},[res,simTime,frame,angle,moonOn,zoom,panTick]);

  const toggleMoon=()=>{const n=!moonOn;setMoonOn(n);go(speed,angle,n,endless);};
  const toggleEndless=()=>{const n=!endless;setEndless(n);go(speed,angle,moonOn,n);};

  const TB=(active,ac="#2070c0",abc="70,130,220")=>({...btnBase,padding:"8px 16px",fontSize:14,
    background:active?`rgba(${abc},0.1)`:"#fff",
    border:`1px solid ${active?`rgba(${abc},0.35)`:"#d8dce4"}`,
    color:active?ac:"#8090a8"});

  return(
    <div style={{background:"#f0f2f6",minHeight:"100vh",color:"#1a2a40",fontFamily:FONT,display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 14px 48px"}}>

      {/* Header */}
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:8}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"radial-gradient(circle at 35% 35%,#5ab8f0,#1a6aa0,#0a3a5a)",boxShadow:"0 2px 12px rgba(40,120,200,0.25)"}}/> 
          <h1 style={{fontSize:28,fontWeight:700,letterSpacing:".03em",color:"#1a2a40",margin:0}}>Free Return</h1>
          <div style={{width:16,height:16,borderRadius:"50%",background:"radial-gradient(circle at 40% 35%,#e0dcd0,#a09888)",boxShadow:"0 1px 6px rgba(120,100,60,0.2)"}}/>
          <button onClick={()=>setShowHelp(true)} style={{...btnBase,width:32,height:32,padding:0,fontSize:16,borderRadius:"50%",background:"#fff",border:"1px solid #d0d6e0",color:"#6080a0",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:4,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>?</button>
        </div>
        <p style={{fontSize:15,color:"#6880a0",margin:0,fontWeight:500}}>地球–月 自由帰還軌道シミュレータ</p>
      </div>

      {/* Help Overlay */}
      {showHelp&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px 16px",overflowY:"auto"}} onClick={()=>setShowHelp(false)}>
          <div style={{width:"100%",maxWidth:640,background:"#fff",border:"1px solid #e0e4ea",borderRadius:16,padding:"28px 24px",position:"relative",boxShadow:"0 8px 40px rgba(0,0,0,0.12)"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowHelp(false)} style={{position:"absolute",top:12,right:14,...btnBase,width:36,height:36,padding:0,fontSize:20,borderRadius:"50%",background:"#f5f7fa",border:"1px solid #e0e4ea",color:"#6080a0",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            <h2 style={{fontSize:22,fontWeight:700,color:"#1a2a40",margin:"0 0 20px"}}>使い方ガイド</h2>
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#2070c0",margin:"0 0 8px"}}>このシミュレータについて</h3>
              <p style={{fontSize:14,lineHeight:1.8,color:"#4a5a70",margin:0}}>
                地球低軌道（LEO、高度185km）から宇宙機を打ち出し、月の重力を利用して地球に帰還する<strong style={{color:"#1a3050"}}>自由帰還軌道</strong>をシミュレーションします。
                物理モデルは制限三体問題（CR3BP）で、地球–月系の回転座標系における運動方程式を4次ルンゲ–クッタ法（RK4）で数値積分しています。
              </p>
            </div>
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#2070c0",margin:"0 0 8px"}}>操作方法</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {icon:"🚀",title:"初速度",desc:"スライダーまたは数値入力で初速度（km/s）を設定します。LEO円軌道速度は約7.79 km/s。自由帰還軌道には約10.93 km/s（Δv ≈ 3.14 km/s）が必要です。"},
                  {icon:"🧭",title:"発射角度",desc:"0° が月の公転方向（prograde）です。角度を変えると軌道が大きく変化します。"},
                  {icon:"▶",title:"発射 / 停止",desc:"「発射」で再計算＆アニメーション開始。再生中は「停止」で一時停止できます。"},
                  {icon:"🌕",title:"月 ON / OFF",desc:"月の重力を無効にして、月がない場合の軌道と比較できます。"},
                  {icon:"🔄",title:"座標系切替",desc:"「回転座標系」は地球–月の軸が固定された系。「慣性座標系」は月が地球の周りを公転する様子が見えます。"},
                ].map(({icon,title,desc})=>(
                  <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,lineHeight:"28px",flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1a3050",marginBottom:2}}>{title}</div>
                      <div style={{fontSize:13,lineHeight:1.7,color:"#5a6a80"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#2070c0",margin:"0 0 8px"}}>表示操作</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {icon:"🔍",title:"ズーム",desc:"キャンバス下のスライダーで拡大・縮小。月の近傍を拡大して観察できます。"},
                  {icon:"✋",title:"パン（移動）",desc:"キャンバスをドラッグして表示領域を移動。「リセット」ボタンでズーム・パンを初期位置に戻します。"},
                  {icon:"⏩",title:"再生速度",desc:"×0.2（スロー）〜 ×5.0（高速）で再生速度を調整。"},
                  {icon:"⬇",title:"動画保存",desc:"「動画保存」ボタンで現在の設定でのシミュレーションをWebM動画としてダウンロードできます。"},
                ].map(({icon,title,desc})=>(
                  <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,lineHeight:"28px",flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1a3050",marginBottom:2}}>{title}</div>
                      <div style={{fontSize:13,lineHeight:1.7,color:"#5a6a80"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#2070c0",margin:"0 0 8px"}}>表示情報</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {icon:"📊",title:"ステータス",desc:"初速度、Δv（TLI噴射量）、月最接近距離、所要時間、結果（地球到着/月面衝突/脱出）を表示します。"},
                  {icon:"⏱",title:"経過時間",desc:"キャンバス右上にミッション経過時間が表示されます。"},
                ].map(({icon,title,desc})=>(
                  <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,lineHeight:"28px",flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1a3050",marginBottom:2}}>{title}</div>
                      <div style={{fontSize:13,lineHeight:1.7,color:"#5a6a80"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #e8ecf0",fontSize:12,color:"#a0aab8",lineHeight:1.6,textAlign:"center"}}>
              CR3BP (Circular Restricted Three-Body Problem) · RK4 Integration · μ = 0.01215
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{width:"100%",maxWidth:640,...card,padding:"18px 20px",marginBottom:12}}>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:14,color:"#4a6080",fontWeight:600}}>初速度 |v₀| <span style={{fontSize:12,opacity:.6}}>km/s</span></span>
            <input type="text" value={speedStr} onChange={e=>setSpeedStr(e.target.value)} onBlur={e=>commitSpeed(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commitSpeed(e.target.value);}} style={{...numInput,color:"#1860b0"}} />
          </div>
          <input type="range" min={9} max={11.5} step={.0005} value={speed} onChange={e=>updateSpeed(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#2080d0",height:8}} />
        </div>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:14,color:"#4a6080",fontWeight:600}}>発射角度 θ <span style={{fontSize:12,opacity:.5}}>( 0° = prograde )</span></span>
            <input type="text" value={angleStr} onChange={e=>setAngleStr(e.target.value)} onBlur={e=>commitAngle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commitAngle(e.target.value);}} style={{...numInput,color:"#a07020"}} />
          </div>
          <input type="range" min={-180} max={180} step={.5} value={angle} onChange={e=>updateAngle(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#c09030",height:8}} />
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",justifyContent:"flex-end"}}>
          {running?(
            <button onClick={stop} style={{...btnBase,padding:"10px 28px",fontSize:15,background:"rgba(220,50,50,0.08)",border:"1px solid rgba(220,50,50,0.3)",color:"#d04040"}}>⏹ 停止</button>
          ):(
            <button onClick={()=>go(speed,angle,moonOn,endless)} disabled={recording}
              style={{...btnBase,padding:"10px 28px",fontSize:15,
                background:recording?"#f5f7fa":"linear-gradient(135deg,#2080d0,#1868b0)",
                border:recording?"1px solid #d8dce4":"1px solid #1868b0",color:recording?"#b0bcc8":"#fff",
                boxShadow:recording?"none":"0 2px 12px rgba(30,100,180,0.2)",cursor:recording?"not-allowed":"pointer"}}>
              ▶ 発射
            </button>
          )}
        </div>
      </div>

      {/* Toggle Bar */}
      <div style={{width:"100%",maxWidth:640,display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",justifyContent:"center"}}>
        <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:"1px solid #d8dce4"}}>
          {[{key:"rotating",label:"回転座標系"},{key:"inertial",label:"慣性座標系"}].map(f=>(
            <button key={f.key} onClick={()=>setFrame(f.key)}
              style={{...btnBase,padding:"8px 18px",fontSize:14,borderRadius:0,border:"none",
                background:frame===f.key?"rgba(30,120,210,0.08)":"#fff",
                color:frame===f.key?"#1868b0":"#8090a8"}}>{f.label}</button>))}
        </div>
        <button onClick={toggleMoon} style={TB(moonOn,"#a08020","180,140,30")}>{moonOn?"🌕 月 ON":"🌑 月 OFF"}</button>
        <button onClick={toggleEndless} style={TB(endless,"#8040c0","130,60,200")}>{endless?"∞ 無限追跡":"∞ 通常"}</button>
        <button onClick={resetView} style={TB(false)}>⟲ リセット</button>
        <button onClick={startRecording} disabled={recording||!res}
          style={{...TB(recording,"#d04040","220,50,50"),cursor:(recording||!res)?"not-allowed":"pointer"}}>
          {recording?`⏺ ${recordProgress}%`:"⬇ 動画保存"}
        </button>
      </div>

      {/* Canvas */}
      <div style={{width:"100%",maxWidth:640,position:"relative"}}>
        <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
          style={{width:"100%",aspectRatio:"1",borderRadius:12,border:`1px solid ${recording?"rgba(220,50,50,0.3)":"#d8dce4"}`,cursor:"grab",touchAction:"none",display:"block",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}} />
        {recording&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:4,borderRadius:"0 0 12px 12px",overflow:"hidden"}}><div style={{height:"100%",width:`${recordProgress}%`,background:"linear-gradient(90deg,#d04040,#e08030)",transition:"width 0.1s"}}/></div>}
      </div>

      {/* Zoom + Playback */}
      <div style={{width:"100%",maxWidth:640,marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,...card,padding:"10px 14px"}}>
          <span style={{fontSize:14,color:"#8090a8"}}>🔍</span>
          <input type="range" min={0.3} max={8} step={.05} value={zoom} onChange={e=>{setZoom(parseFloat(e.target.value));setPanTick(t=>t+1);}} style={{flex:1,accentColor:"#5090c0"}} />
          <span style={{fontSize:15,fontWeight:700,color:"#4a6a8a",fontVariantNumeric:"tabular-nums",minWidth:42,textAlign:"right"}}>×{zoom.toFixed(1)}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,...card,padding:"10px 14px"}}>
          <span style={{fontSize:14,color:"#8090a8"}}>⏩</span>
          <input type="range" min={.2} max={5} step={.1} value={playbackSpeed} onChange={e=>setPlaybackSpeed(parseFloat(e.target.value))} style={{flex:1,accentColor:"#509040"}} />
          <span style={{fontSize:15,fontWeight:700,color:"#407830",fontVariantNumeric:"tabular-nums",minWidth:42,textAlign:"right"}}>×{playbackSpeed.toFixed(1)}</span>
        </div>
      </div>

      {/* Stats */}
      {res&&(
        <div style={{width:"100%",maxWidth:640,marginTop:12,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[
            {l:"初速度",v:`${(speed*V_SCALE).toFixed(2)} km/s`,c:"#1860b0"},
            {l:"Δv (TLI)",v:`${dvKmps(speed)} km/s`,c:"#1860b0"},
            {l:"月最接近",v:moonOn?`${Math.round(res.minMD*KM).toLocaleString()} km`:"—",c:"#1860b0"},
            {l:"所要時間",v:`${Math.round(simH(res.totalTime))}h`,c:"#1860b0"},
            {l:"結果",v:END_LABELS[res.endReason]||res.endReason,c:(res.endReason==="earth_collision"||res.endReason==="moon_collision")?"#c04020":"#1860b0"},
          ].map(({l,v,c})=>(
            <div key={l} style={{...card,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:11,color:"#8898b0",fontWeight:600,marginBottom:4}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:c,fontVariantNumeric:"tabular-nums"}}>{v}</div>
            </div>))}
        </div>
      )}
    </div>
  );
}
