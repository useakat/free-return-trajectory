import { useState, useEffect, useRef, useCallback } from "react";

const MU=0.012150585,EARTH_X=-MU,MOON_X=1-MU,R_LEO=(6371+185)/384400,R_EARTH=6371/384400,R_MOON_NORM=1737/384400,V_CIRC=Math.sqrt((1-MU)/R_LEO),KM=384400,SIM_DT=0.00005,PLAYBACK_DT=0.004;

function derivs([x,y,vx,vy],mo){const x1=x+MU,x2=x-(1-MU),r1=Math.sqrt(x1*x1+y*y),r2=Math.sqrt(x2*x2+y*y),mt=mo?MU:0;return[vx,vy,2*vy+x-(1-MU)*x1/r1**3-mt*x2/r2**3,-2*vx+y-(1-MU)*y/r1**3-mt*y/r2**3];}
function rk4(s,dt,mo){const k1=derivs(s,mo),k2=derivs(s.map((v,i)=>v+.5*dt*k1[i]),mo),k3=derivs(s.map((v,i)=>v+.5*dt*k2[i]),mo),k4=derivs(s.map((v,i)=>v+dt*k3[i]),mo);return s.map((v,i)=>v+(dt/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));}
function simulate(speed,angleDeg,moonOn){const rad=angleDeg*Math.PI/180;let st=[EARTH_X+R_LEO,0,speed*Math.sin(rad),speed*Math.cos(rad)];const pts=[{x:st[0],y:st[1],t:0,vx:st[2],vy:st[3]}];let minMD=999,time=0,endReason="timeout";for(let i=0;i<800000;i++){st=rk4(st,SIM_DT,moonOn);time+=SIM_DT;const rm=Math.sqrt((st[0]-MOON_X)**2+st[1]**2);if(rm<minMD)minMD=rm;if(moonOn&&rm<R_MOON_NORM){pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});endReason="moon_collision";break;}const re=Math.sqrt((st[0]-EARTH_X)**2+st[1]**2);if(i>500&&re<R_EARTH){pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});endReason="earth_collision";break;}if(Math.abs(st[0])>4||Math.abs(st[1])>4){pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});endReason="escape";break;}if(i%40===0)pts.push({x:st[0],y:st[1],t:time,vx:st[2],vy:st[3]});}return{pts,minMD,totalTime:time,endReason};}
function toI(x,y,t){const c=Math.cos(t),s=Math.sin(t);return{x:x*c-y*s,y:x*s+y*c};}
function dvKmps(s){return((s-V_CIRC)*V_SCALE).toFixed(3);}
const V_SCALE=7.79/V_CIRC; // normalized units -> km/s
function simH(t){return t*104.3;}
const END_LABELS={earth_collision:"地球到着",moon_collision:"月面衝突",escape:"脱出",timeout:"時間切れ"};
const PRESETS=[{label:"低軌道",spd:V_CIRC+1.5,ang:0},{label:"楕円",spd:V_CIRC+2.5,ang:0},{label:"自由帰還",spd:10.6826,ang:0},{label:"月衝突",spd:10.6828,ang:0},{label:"斜め発射",spd:10.75,ang:12}];

const FONT="'DM Sans','Noto Sans JP',system-ui,sans-serif";
const card={background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12};
const numInput={background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,fontSize:16,fontWeight:700,fontFamily:"'DM Mono',monospace",fontVariantNumeric:"tabular-nums",padding:"6px 10px",width:110,textAlign:"right",outline:"none"};
const btnBase={fontFamily:FONT,fontWeight:600,cursor:"pointer",borderRadius:8,transition:"all 0.2s"};

function drawMainCanvas(ctx,W,H,res,simTime,frameMode,angle,moonOn,zoom,pan){
  const isIn=frameMode==="inertial";
  const visible=[];for(const p of res.pts){if(p.t<=simTime)visible.push(p);else break;}
  let axs=[0],ays=[0];
  if(isIn){axs.push(-1.15,1.15);ays.push(-1.15,1.15);for(const p of res.pts){const pi=toI(p.x,p.y,p.t),ei=toI(EARTH_X,0,p.t);axs.push(pi.x-ei.x);ays.push(pi.y-ei.y);}}
  else{axs.push(EARTH_X,MOON_X);ays.push(0);for(const p of res.pts){axs.push(p.x);ays.push(p.y);}}
  const bx0=Math.min(...axs),bx1=Math.max(...axs),by0=Math.min(...ays),by1=Math.max(...ays);
  const rX=bx1-bx0||1,rY=by1-by0||1,cX=(bx0+bx1)/2,cY=(by0+by1)/2;
  const baseSc=Math.min(W,H)*.64/Math.max(rX,rY),sc=baseSc*zoom;
  const ccx=W/2-cX*sc+pan.ox,ccy=H/2+cY*sc+pan.oy;
  ctx.fillStyle="#04040e";ctx.fillRect(0,0,W,H);
  const rng2=s=>{let h=s|0;return()=>{h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>13),0x45d9f3b);return((h^(h>>>16))>>>0)/4294967296;};};
  const rand=rng2(77);for(let i=0;i<150;i++){ctx.fillStyle=`rgba(180,200,240,${.07+rand()*.22})`;ctx.fillRect(rand()*W,rand()*H,rand()>.92?1.3:.6,.6);}
  const ts=(wx,wy)=>[ccx+wx*sc,ccy-wy*sc];
  const[ex,ey]=isIn?ts(0,0):ts(EARTH_X,0);
  let mx,my;if(isIn){const mI2=toI(MOON_X,0,simTime),eI2=toI(EARTH_X,0,simTime);[mx,my]=ts(mI2.x-eI2.x,mI2.y-eI2.y);}else{[mx,my]=ts(MOON_X,0);}
  ctx.strokeStyle="rgba(70,110,170,0.04)";ctx.lineWidth=.5;for(let r=.25;r<=1.25;r+=.25){ctx.beginPath();ctx.arc(ex,ey,r*sc,0,Math.PI*2);ctx.stroke();}
  if(isIn){ctx.strokeStyle="rgba(180,170,150,0.07)";ctx.lineWidth=.8;ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(ex,ey,sc,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle="rgba(180,170,150,0.04)";ctx.lineWidth=.8;ctx.beginPath();for(let i=0;i<=200;i++){const t2=(i/200)*simTime,m2=toI(MOON_X,0,t2),e2=toI(EARTH_X,0,t2),[sx2,sy2]=ts(m2.x-e2.x,m2.y-e2.y);i===0?ctx.moveTo(sx2,sy2):ctx.lineTo(sx2,sy2);}ctx.stroke();}
  else{ctx.strokeStyle="rgba(70,110,170,0.08)";ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(mx,my);ctx.stroke();ctx.setLineDash([]);}
  if(!isIn){const rH2=Math.cbrt(MU/3),[l1x,l1y]=ts(1-MU-rH2,0);ctx.fillStyle="rgba(255,200,100,0.2)";ctx.beginPath();ctx.arc(l1x,l1y,1.5,0,Math.PI*2);ctx.fill();ctx.font="8px system-ui";ctx.textAlign="center";ctx.fillText("L₁",l1x,l1y-6);}
  const eR=Math.max(R_EARTH*sc,5);const eg=ctx.createRadialGradient(ex-eR*.2,ey-eR*.2,eR*.1,ex,ey,eR);eg.addColorStop(0,"#7ec8f0");eg.addColorStop(.4,"#3d8ec4");eg.addColorStop(1,"#0d2e4a");ctx.beginPath();ctx.arc(ex,ey,eR,0,Math.PI*2);ctx.fillStyle=eg;ctx.fill();
  const atm=ctx.createRadialGradient(ex,ey,eR,ex,ey,eR+7);atm.addColorStop(0,"rgba(80,160,255,0.18)");atm.addColorStop(1,"rgba(80,160,255,0)");ctx.beginPath();ctx.arc(ex,ey,eR+7,0,Math.PI*2);ctx.fillStyle=atm;ctx.fill();
  const leoR=R_LEO*sc;if(leoR>8){ctx.strokeStyle="rgba(100,200,255,0.12)";ctx.lineWidth=.5;ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(ex,ey,leoR,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle="rgba(110,160,210,0.5)";ctx.font="600 10px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("地球",ex,ey+eR+14);
  if(moonOn){const mR=Math.max(R_MOON_NORM*sc,3);const mgr=ctx.createRadialGradient(mx-mR*.2,my-mR*.2,mR*.05,mx,my,mR);mgr.addColorStop(0,"#f0ece0");mgr.addColorStop(.5,"#c0b8a0");mgr.addColorStop(1,"#706858");ctx.beginPath();ctx.arc(mx,my,mR,0,Math.PI*2);ctx.fillStyle=mgr;ctx.fill();ctx.fillStyle="rgba(190,180,160,0.5)";ctx.font="600 10px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("月",mx,my+mR+14);}
  if(!isIn&&visible.length<5){const[lpx,lpy]=ts(EARTH_X+R_LEO,0),aL=25,rd=angle*Math.PI/180,adx=Math.sin(rd)*aL,ady=-Math.cos(rd)*aL;ctx.strokeStyle="rgba(255,180,80,0.5)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(lpx,lpy);ctx.lineTo(lpx+adx,lpy+ady);ctx.stroke();const hl=6,aa=Math.atan2(ady,adx);ctx.beginPath();ctx.moveTo(lpx+adx,lpy+ady);ctx.lineTo(lpx+adx-hl*Math.cos(aa-.4),lpy+ady-hl*Math.sin(aa-.4));ctx.moveTo(lpx+adx,lpy+ady);ctx.lineTo(lpx+adx-hl*Math.cos(aa+.4),lpy+ady-hl*Math.sin(aa+.4));ctx.stroke();}
  if(visible.length>1){for(let i=1;i<visible.length;i++){const tF=visible[i].t/res.totalTime,p=visible[i],pp=visible[i-1];let sx,sy,px2,py2;if(isIn){const pi=toI(p.x,p.y,p.t),ei=toI(EARTH_X,0,p.t);[sx,sy]=ts(pi.x-ei.x,pi.y-ei.y);const ppi=toI(pp.x,pp.y,pp.t),epi=toI(EARTH_X,0,pp.t);[px2,py2]=ts(ppi.x-epi.x,ppi.y-epi.y);}else{[sx,sy]=ts(p.x,p.y);[px2,py2]=ts(pp.x,pp.y);}const md=Math.sqrt((p.x-MOON_X)**2+p.y**2),nm=Math.max(0,Math.min(1,1-md*2.5));ctx.strokeStyle=`rgba(${Math.round(50+nm*205)},${Math.round(190+nm*65-nm*nm*120)},${Math.round(255-nm*225)},${.06+tF*.94})`;ctx.lineWidth=.8+tF*1.2;ctx.beginPath();ctx.moveTo(px2,py2);ctx.lineTo(sx,sy);ctx.stroke();}
  const last=visible[visible.length-1];let lx,ly;if(isIn){const li=toI(last.x,last.y,last.t),lei=toI(EARTH_X,0,last.t);[lx,ly]=ts(li.x-lei.x,li.y-lei.y);}else{[lx,ly]=ts(last.x,last.y);}const glow=ctx.createRadialGradient(lx,ly,0,lx,ly,11);glow.addColorStop(0,"rgba(120,230,255,0.85)");glow.addColorStop(.4,"rgba(120,230,255,0.12)");glow.addColorStop(1,"rgba(120,230,255,0)");ctx.beginPath();ctx.arc(lx,ly,11,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();ctx.beginPath();ctx.arc(lx,ly,2,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();}
  if(simTime>=res.totalTime&&res.endReason!=="timeout"){const lb=END_LABELS[res.endReason]||res.endReason;const isC=res.endReason==="earth_collision"||res.endReason==="moon_collision";const last2=res.pts[res.pts.length-1];let fx,fy;if(isIn){const fi=toI(last2.x,last2.y,last2.t),fei=toI(EARTH_X,0,last2.t);[fx,fy]=ts(fi.x-fei.x,fi.y-fei.y);}else{[fx,fy]=ts(last2.x,last2.y);}if(isC){ctx.beginPath();ctx.arc(fx,fy,18,0,Math.PI*2);const boom=ctx.createRadialGradient(fx,fy,0,fx,fy,18);boom.addColorStop(0,"rgba(255,200,50,0.7)");boom.addColorStop(.5,"rgba(255,100,30,0.3)");boom.addColorStop(1,"rgba(255,50,20,0)");ctx.fillStyle=boom;ctx.fill();}ctx.fillStyle=isC?"rgba(255,120,80,0.8)":"rgba(120,200,255,0.6)";ctx.font="600 12px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(lb,fx,fy-20);}
  ctx.fillStyle="rgba(120,160,200,0.25)";ctx.font="600 10px system-ui,sans-serif";ctx.textAlign="left";ctx.fillText(isIn?"慣性座標系":"回転座標系",10,H-10);
  const hours=simH(simTime),days=Math.floor(hours/24),hrs=Math.floor(hours%24);
  const hrsStr=String(hrs).padStart(2,'0');const timeStr=days>0?`${days}日 ${hrsStr}時間`:`${hrsStr}時間`;
  ctx.save();ctx.font="600 20px system-ui,sans-serif";const tw2=ctx.measureText(timeStr).width;
  const px=W-tw2-20,py=8,ph=32,pw=tw2+14;
  ctx.fillStyle="rgba(6,6,16,0.7)";ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.fill();
  ctx.strokeStyle="rgba(100,160,220,0.15)";ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.stroke();
  ctx.fillStyle="rgba(160,210,255,0.85)";ctx.font="600 20px system-ui,sans-serif";ctx.textAlign="right";ctx.fillText(timeStr,px+pw-7,py+23);ctx.restore();
}

export default function App(){
  const canvasRef=useRef(null);
  const[speed,setSpeed]=useState(10.6826);const[angle,setAngle]=useState(0);const[moonOn,setMoonOn]=useState(true);
  const[res,setRes]=useState(null);const[simTime,setSimTime]=useState(0);const[running,setRunning]=useState(false);
  const[frame,setFrame]=useState("rotating");const[playbackSpeed,setPlaybackSpeed]=useState(1);const[zoom,setZoom]=useState(1);
  const af=useRef(null);const stopRef=useRef(false);const panRef=useRef({ox:0,oy:0});const[panTick,setPanTick]=useState(0);const dragRef=useRef(null);
  const[speedStr,setSpeedStr]=useState((10.6826*V_SCALE).toFixed(3));const[angleStr,setAngleStr]=useState("0.0");const playbackRef=useRef(1);
  const[recording,setRecording]=useState(false);const[recordProgress,setRecordProgress]=useState(0);
  const[showHelp,setShowHelp]=useState(false);
  useEffect(()=>{playbackRef.current=playbackSpeed;},[playbackSpeed]);

  const go=useCallback((s,a,m)=>{stopRef.current=true;if(af.current){cancelAnimationFrame(af.current);af.current=null;}const r=simulate(s,a,m);setRes(r);setSimTime(0);stopRef.current=false;setRunning(true);},[]);
  const stop=useCallback(()=>{stopRef.current=true;if(af.current){cancelAnimationFrame(af.current);af.current=null;}setRunning(false);},[]);
  useEffect(()=>{go(speed,angle,moonOn);},[]);
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
    rec.start();const totalFrames=Math.ceil(res.totalTime/PLAYBACK_DT);let fi=0;
    const pn={...panRef.current},cz=zoom,cf=frame,ca=angle,cm=moonOn;
    const next=()=>{if(fi>totalFrames){setTimeout(()=>{rec.stop();},100);return;}const t=Math.min(fi*PLAYBACK_DT,res.totalTime);drawMainCanvas(rctx,600,600,res,t,cf,ca,cm,cz,pn);setSimTime(t);setRecordProgress(Math.round((fi/totalFrames)*100));fi++;requestAnimationFrame(next);};
    setTimeout(next,200);
  },[res,recording,zoom,frame,angle,moonOn,stop]);

  useEffect(()=>{const cvs=canvasRef.current;if(!cvs||!res)return;const pan=panRef.current;const dpr=window.devicePixelRatio||1;const dW=cvs.clientWidth,dH=cvs.clientHeight;cvs.width=dW*dpr;cvs.height=dH*dpr;const ctx=cvs.getContext("2d");ctx.scale(dpr,dpr);drawMainCanvas(ctx,dW,dH,res,simTime,frame,angle,moonOn,zoom,pan);},[res,simTime,frame,angle,moonOn,zoom,panTick]);


  const toggleMoon=()=>{const n=!moonOn;setMoonOn(n);go(speed,angle,n);};

  const TB=(active,color="#7cc4ee")=>({...btnBase,padding:"8px 16px",fontSize:14,
    background:active?`rgba(${color==="#e0c860"?"220,200,100":color==="#f07070"?"255,80,80":"70,150,230"},0.12)`:"rgba(255,255,255,0.02)",
    border:`1px solid ${active?`rgba(${color==="#e0c860"?"220,200,100":color==="#f07070"?"255,80,80":"70,150,230"},0.3)`:"rgba(255,255,255,0.07)"}`,
    color:active?color:"rgba(150,170,200,0.5)"});

  return(
    <div style={{background:"linear-gradient(180deg,#060614 0%,#0a0e20 50%,#080c18 100%)",minHeight:"100vh",color:"#c0d0e0",fontFamily:FONT,display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 14px 48px"}}>

      {/* Header */}
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:8}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"radial-gradient(circle at 35% 35%,#6dbcf2,#1e5a8a,#0a2a4a)",boxShadow:"0 0 24px rgba(80,160,255,0.2)"}}/> 
          <h1 style={{fontSize:28,fontWeight:700,letterSpacing:".03em",color:"#e4eef8",margin:0}}>Free Return</h1>
          <div style={{width:16,height:16,borderRadius:"50%",background:"radial-gradient(circle at 40% 35%,#e8e4d8,#908878)",boxShadow:"0 0 10px rgba(200,190,160,0.15)"}}/>
          <button onClick={()=>setShowHelp(true)} style={{...btnBase,width:32,height:32,padding:0,fontSize:16,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(160,190,230,0.6)",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:4}}>?</button>
        </div>
        <p style={{fontSize:15,color:"rgba(150,175,210,0.55)",margin:0,fontWeight:500}}>地球–月 自由帰還軌道シミュレータ</p>
      </div>

      {/* Help Overlay */}
      {showHelp&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,4,14,0.92)",backdropFilter:"blur(8px)",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px 16px",overflowY:"auto"}} onClick={()=>setShowHelp(false)}>
          <div style={{width:"100%",maxWidth:640,background:"rgba(10,14,32,0.95)",border:"1px solid rgba(100,150,220,0.12)",borderRadius:16,padding:"28px 24px",position:"relative"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowHelp(false)} style={{position:"absolute",top:12,right:14,...btnBase,width:36,height:36,padding:0,fontSize:20,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(180,200,230,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>

            <h2 style={{fontSize:22,fontWeight:700,color:"#d0e0f0",margin:"0 0 20px",letterSpacing:".02em"}}>使い方ガイド</h2>

            {/* What is this */}
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#7cc4ee",margin:"0 0 8px"}}>このシミュレータについて</h3>
              <p style={{fontSize:14,lineHeight:1.8,color:"rgba(180,200,230,0.7)",margin:0}}>
                地球低軌道（LEO、高度185km）から宇宙機を打ち出し、月の重力を利用して地球に帰還する<strong style={{color:"#a0d0f0"}}>自由帰還軌道</strong>をシミュレーションします。
                物理モデルは制限三体問題（CR3BP）で、地球–月系の回転座標系における運動方程式を4次ルンゲ–クッタ法（RK4）で数値積分しています。
              </p>
            </div>

            {/* Controls */}
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#7cc4ee",margin:"0 0 8px"}}>操作方法</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {icon:"🚀",title:"初速度",desc:"スライダーまたは数値入力で初速度（km/s）を設定します。LEO円軌道速度は約7.79 km/s。自由帰還軌道には約10.93 km/s（Δv ≈ 3.14 km/s）が必要です。"},
                  {icon:"🧭",title:"発射角度",desc:"0° が月の公転方向（prograde）です。角度を変えると軌道が大きく変化します。"},
                  {icon:"▶",title:"発射 / 停止",desc:"「発射」で再計算＆アニメーション開始。再生中は「停止」で一時停止できます。"},
                  {icon:"🌕",title:"月 ON / OFF",desc:"月の重力を無効にして、月がない場合の軌道と比較できます。月本体は非表示になりますが、月軌道の参照線は残ります。"},
                  {icon:"🔄",title:"座標系切替",desc:"「回転座標系」は地球–月の軸が固定された系。「慣性座標系」は月が地球の周りを公転する様子が見えます。"},
                ].map(({icon,title,desc})=>(
                  <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,lineHeight:"28px",flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0daf0",marginBottom:2}}>{title}</div>
                      <div style={{fontSize:13,lineHeight:1.7,color:"rgba(170,195,225,0.6)"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Viewer */}
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#7cc4ee",margin:"0 0 8px"}}>表示操作</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {icon:"🔍",title:"ズーム",desc:"キャンバス下のスライダーで拡大・縮小。月の近傍を拡大して観察できます。"},
                  {icon:"✋",title:"パン（移動）",desc:"キャンバスをドラッグして表示領域を移動。「リセット」ボタンでズーム・パンを初期位置に戻します。"},
                  {icon:"⏩",title:"再生速度",desc:"×0.2（スロー）〜 ×5.0（高速）で再生速度を調整。月近傍をじっくり見たいときはスローに。"},
                  {icon:"⬇",title:"動画保存",desc:"「動画保存」ボタンで現在の設定でのシミュレーションをWebM動画としてダウンロードできます。"},
                ].map(({icon,title,desc})=>(
                  <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,lineHeight:"28px",flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0daf0",marginBottom:2}}>{title}</div>
                      <div style={{fontSize:13,lineHeight:1.7,color:"rgba(170,195,225,0.6)"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Display */}
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#7cc4ee",margin:"0 0 8px"}}>表示情報</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {icon:"📊",title:"ステータス",desc:"初速度、Δv（TLI噴射量）、月最接近距離、所要時間、結果（地球到着/月面衝突/脱出）を表示します。"},
                  {icon:"⏱",title:"経過時間",desc:"キャンバス右上にミッション経過時間が表示されます。"},
                ].map(({icon,title,desc})=>(
                  <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,lineHeight:"28px",flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0daf0",marginBottom:2}}>{title}</div>
                      <div style={{fontSize:13,lineHeight:1.7,color:"rgba(170,195,225,0.6)"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(100,150,220,0.08)",fontSize:12,color:"rgba(140,165,200,0.35)",lineHeight:1.6,textAlign:"center"}}>
              CR3BP (Circular Restricted Three-Body Problem) · RK4 Integration · μ = 0.01215
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{width:"100%",maxWidth:640,...card,padding:"18px 20px",marginBottom:12}}>
        {/* Speed */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:14,color:"rgba(160,185,220,0.6)",fontWeight:600}}>初速度 |v₀| <span style={{fontSize:12,opacity:.5}}>km/s</span></span>
            <input type="text" value={speedStr} onChange={e=>setSpeedStr(e.target.value)} onBlur={e=>commitSpeed(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commitSpeed(e.target.value);}} style={{...numInput,color:"#7cc4ee"}} />
          </div>
          <input type="range" min={9} max={11.5} step={.0005} value={speed} onChange={e=>updateSpeed(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#4a9cc8",height:8}} />
        </div>
        {/* Angle */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:14,color:"rgba(160,185,220,0.6)",fontWeight:600}}>発射角度 θ <span style={{fontSize:12,opacity:.5}}>( 0° = prograde )</span></span>
            <input type="text" value={angleStr} onChange={e=>setAngleStr(e.target.value)} onBlur={e=>commitAngle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commitAngle(e.target.value);}} style={{...numInput,color:"#e0b868"}} />
          </div>
          <input type="range" min={-180} max={180} step={.5} value={angle} onChange={e=>updateAngle(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#c09840",height:8}} />
        </div>
        {/* Launch / Stop */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",justifyContent:"flex-end"}}>
          {running?(
            <button onClick={stop} style={{...btnBase,padding:"10px 28px",fontSize:15,background:"rgba(255,70,70,0.12)",border:"1px solid rgba(255,70,70,0.35)",color:"#f08080"}}>⏹ 停止</button>
          ):(
            <button onClick={()=>go(speed,angle,moonOn)} disabled={recording}
              style={{...btnBase,padding:"10px 28px",fontSize:15,
                background:recording?"rgba(60,120,200,0.03)":"linear-gradient(135deg,rgba(60,140,230,0.2),rgba(40,100,200,0.14))",
                border:"1px solid rgba(70,150,240,0.3)",color:recording?"rgba(130,150,170,0.2)":"#7cc4ee",
                boxShadow:recording?"none":"0 0 20px rgba(60,140,230,0.08)",cursor:recording?"not-allowed":"pointer"}}>
              ▶ 発射
            </button>
          )}
        </div>
      </div>

      {/* Toggle Bar */}
      <div style={{width:"100%",maxWidth:640,display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",justifyContent:"center"}}>
        <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:"1px solid rgba(80,140,200,0.12)"}}>
          {[{key:"rotating",label:"回転座標系"},{key:"inertial",label:"慣性座標系"}].map(f=>(
            <button key={f.key} onClick={()=>setFrame(f.key)}
              style={{...btnBase,padding:"8px 18px",fontSize:14,borderRadius:0,border:"none",
                background:frame===f.key?"rgba(60,130,220,0.14)":"transparent",
                color:frame===f.key?"#7cc4ee":"rgba(140,160,185,0.45)"}}>{f.label}</button>))}
        </div>
        <button onClick={toggleMoon} style={TB(moonOn,"#e0c860")}>{moonOn?"🌕 月 ON":"🌑 月 OFF"}</button>
        <button onClick={resetView} style={TB(false)}>⟲ リセット</button>
        <button onClick={startRecording} disabled={recording||!res}
          style={{...TB(recording,"#f07070"),cursor:(recording||!res)?"not-allowed":"pointer"}}>
          {recording?`⏺ ${recordProgress}%`:"⬇ 動画保存"}
        </button>
      </div>

      {/* Canvas */}
      <div style={{width:"100%",maxWidth:640,position:"relative"}}>
        <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
          style={{width:"100%",aspectRatio:"1",borderRadius:12,border:`1px solid ${recording?"rgba(255,60,60,0.25)":"rgba(60,100,160,0.1)"}`,cursor:"grab",touchAction:"none",display:"block"}} />
        {recording&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:4,borderRadius:"0 0 12px 12px",overflow:"hidden"}}><div style={{height:"100%",width:`${recordProgress}%`,background:"linear-gradient(90deg,#e06060,#f0a060)",transition:"width 0.1s"}}/></div>}
      </div>

      {/* Zoom + Playback */}
      <div style={{width:"100%",maxWidth:640,marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,...card,padding:"10px 14px"}}>
          <span style={{fontSize:14,color:"rgba(150,170,200,0.45)"}}>🔍</span>
          <input type="range" min={0.3} max={8} step={.05} value={zoom} onChange={e=>{setZoom(parseFloat(e.target.value));setPanTick(t=>t+1);}} style={{flex:1,accentColor:"#5a8aaa"}} />
          <span style={{fontSize:15,fontWeight:700,color:"rgba(140,170,200,0.55)",fontVariantNumeric:"tabular-nums",minWidth:42,textAlign:"right"}}>×{zoom.toFixed(1)}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,...card,padding:"10px 14px"}}>
          <span style={{fontSize:14,color:"rgba(150,170,200,0.45)"}}>⏩</span>
          <input type="range" min={.2} max={5} step={.1} value={playbackSpeed} onChange={e=>setPlaybackSpeed(parseFloat(e.target.value))} style={{flex:1,accentColor:"#6a9a48"}} />
          <span style={{fontSize:15,fontWeight:700,color:"#8bc46a",fontVariantNumeric:"tabular-nums",minWidth:42,textAlign:"right"}}>×{playbackSpeed.toFixed(1)}</span>
        </div>
      </div>


      {/* Stats */}
      {res&&(
        <div style={{width:"100%",maxWidth:640,marginTop:12,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[
            {l:"初速度",v:`${(speed*V_SCALE).toFixed(2)} km/s`,c:"#7cc4ee"},
            {l:"Δv (TLI)",v:`${dvKmps(speed)} km/s`,c:"#7cc4ee"},
            {l:"月最接近",v:moonOn?`${Math.round(res.minMD*KM).toLocaleString()} km`:"—",c:"#7cc4ee"},
            {l:"所要時間",v:`${Math.round(simH(res.totalTime))}h`,c:"#7cc4ee"},
            {l:"結果",v:END_LABELS[res.endReason]||res.endReason,c:(res.endReason==="earth_collision"||res.endReason==="moon_collision")?"#f09070":"#7cc4ee"},
          ].map(({l,v,c})=>(
            <div key={l} style={{...card,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:11,color:"rgba(150,175,210,0.45)",fontWeight:600,marginBottom:4}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:c,fontVariantNumeric:"tabular-nums"}}>{v}</div>
            </div>))}
        </div>
      )}
    </div>
  );
}
