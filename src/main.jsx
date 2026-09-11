import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import L from 'leaflet'
import {createClient} from '@supabase/supabase-js'
import './styles.css'

const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null

const TYPES = {speed_bump:'مطب سرعة', road_hump:'مطب طريق', pothole:'حفرة', rumble:'مطبّات اهتزازية', unknown:'مطب غير محدد'}
const SEVERITY = {low:'خفيف', medium:'متوسط', high:'مرتفع'}
const SENSOR_TIMEOUT = 8

function distance(a,b,c,d){const R=6371000,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q))}

function App(){
  const [bumps,setBumps]=useState([]),[pos,setPos]=useState(null),[user,setUser]=useState(null)
  const [selected,setSelected]=useState(null),[add,setAdd]=useState(false),[login,setLogin]=useState(false)
  const [admin,setAdmin]=useState(false),[muted,setMuted]=useState(false),[sensorOn,setSensorOn]=useState(false)
  const [sensorPrompt,setSensorPrompt]=useState(null),[sensorStatus,setSensorStatus]=useState('الحساس متوقف')
  const [email,setEmail]=useState(''),[pass,setPass]=useState(''),[mode,setMode]=useState('login')
  const [form,setForm]=useState({type:'speed_bump',severity:'medium',note:''})
  const map=useRef(null),layer=useRef(null),warn=useRef(null),sensor=useRef({enabled:false,baseline:null,last:null,gyro:0,window:[],lastTrigger:0})

  const near=useMemo(()=>{if(!pos)return null;let n=null;for(const b of bumps){const d=distance(pos.lat,pos.lng,b.lat,b.lng);if(!n||d<n.d)n={b,d}}return n},[pos,bumps])

  useEffect(()=>{
    map.current=L.map('map').setView([24.7136,46.6753],13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map.current)
    load()
    if(supabase){
      supabase.auth.getSession().then(({data})=>setUser(data.session?.user||null))
      const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null))
      return()=>subscription.unsubscribe()
    }
  },[])

  useEffect(()=>{
    if(!navigator.geolocation)return
    const id=navigator.geolocation.watchPosition(p=>{
      const x={lat:p.coords.latitude,lng:p.coords.longitude,speed:p.coords.speed};setPos(x)
      if(map.current&&!map.current._centered){map.current.setView([x.lat,x.lng],16);map.current._centered=true}
      if(near&&near.d<300){const m=Math.round(near.d);if(warn.current!==m){warn.current=m;if(!muted&&'speechSynthesis'in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(`تنبيه: مطب أمامك بعد ${m} متر`))}}}
      if(near&&near.d>350)warn.current=null
    },()=>{}, {enableHighAccuracy:true,maximumAge:1500,timeout:10000})
    return()=>navigator.geolocation.clearWatch(id)
  },[bumps,near,muted])

  useEffect(()=>{if(!map.current)return;if(layer.current)layer.current.remove();layer.current=L.layerGroup().addTo(map.current);bumps.forEach(b=>{const icon=L.divIcon({className:'bm',html:b.type==='pothole'?'🕳️':'⚠️',iconSize:[38,38]});L.marker([b.lat,b.lng],{icon}).addTo(layer.current).on('click',()=>setSelected(b))})},[bumps])

  async function load(){if(!supabase)return;const {data,error}=await supabase.from('bumps').select('*').eq('status','active').limit(2000);if(!error)setBumps(data||[])}

  async function addBump(type=form.type, severity=form.severity, note=form.note, source='manual'){
    if(!pos)return alert('فعّل GPS أولاً')
    if(!user){setLogin(true);return}
    const row={lat:pos.lat,lng:pos.lng,type,severity,note:note||null,created_by:user.id,source}
    const {data,error}=await supabase.from('bumps').insert(row).select().single()
    if(error)alert(error.message);else{setBumps(x=>[data,...x]);setSelected(data);setAdd(false)}
  }

  async function vote(k){if(!user)return setLogin(true);const {error}=await supabase.rpc('vote_bump',{p_bump_id:selected.id,p_kind:k});if(error)alert(error.message);else{setSelected(null);load()}}
  async function auth(){if(!supabase)return alert('أضف إعدادات Supabase في .env');const r=mode==='login'?await supabase.auth.signInWithPassword({email,password:pass}):await supabase.auth.signUp({email,password:pass});if(r.error)alert(r.error.message);else setLogin(false)}

  async function enableSensors(){
    if(!window.DeviceMotionEvent){setSensorStatus('هذا الجهاز لا يدعم مستشعر الحركة');return}
    try{
      if(typeof DeviceMotionEvent.requestPermission==='function'){
        const result=await DeviceMotionEvent.requestPermission();if(result!=='granted'){setSensorStatus('تم رفض صلاحية الحساس');return}
      }
      sensor.current.enabled=true;setSensorOn(true);setSensorStatus('الحساس يعمل — ثبّت الهاتف في حامل السيارة')
      window.addEventListener('devicemotion',onMotion,{passive:true})
      window.addEventListener('deviceorientation',onOrientation,{passive:true})
    }catch(e){setSensorStatus('تعذر تشغيل الحساس')}
  }
  function onOrientation(e){const g=sensor.current;g.gyro=Math.max(Math.abs(e.beta||0),Math.abs(e.gamma||0))}
  function onMotion(e){
    const a=e.accelerationIncludingGravity||e.acceleration;if(!a)return
    const vals={x:a.x||0,y:a.y||0,z:a.z||0},g=sensor.current
    if(!g.baseline){g.baseline={...vals};g.last=vals;return}
    for(const k of ['x','y','z'])g.baseline[k]=g.baseline[k]*0.97+vals[k]*0.03
    const deltas={x:vals.x-g.baseline.x,y:vals.y-g.baseline.y,z:vals.z-g.baseline.z}
    const verticalAxis=['x','y','z'].reduce((best,k)=>Math.abs(g.baseline[k])>Math.abs(g.baseline[best])?k:best,'x')
    const vertical=deltas[verticalAxis], lateral=Math.sqrt(deltas.x**2+deltas.y**2+deltas.z**2)
    const now=Date.now();g.window.push({now,vertical,lateral,gyro:g.gyro});g.window=g.window.filter(v=>now-v.now<450)
    const peak=Math.max(...g.window.map(v=>v.lateral),0), peakItem=g.window.reduce((m,v)=>Math.abs(v.vertical)>Math.abs(m.vertical)?v:m,g.window[0]||{vertical:0})
    const shock=peak>5 || (peak>3.5 && Math.abs(g.gyro)>12)
    if(shock && now-g.lastTrigger>15000){g.lastTrigger=now;triggerSensorPrompt(peakItem.vertical>=0?'speed_bump':'pothole',peak)}
    g.last=vals
  }
  function triggerSensorPrompt(suggested,peak){
    setSensorPrompt({suggested,peak,seconds:SENSOR_TIMEOUT})
    let left=SENSOR_TIMEOUT
    const timer=setInterval(()=>{left--;setSensorPrompt(p=>p?({...p,seconds:left}):null);if(left<=0){clearInterval(timer);setSensorPrompt(null);autoAddDetected(suggested)}},1000)
  }
  async function autoAddDetected(type){
    if(!pos||!user){setLogin(true);return}
    const {data,error}=await supabase.from('bumps').insert({lat:pos.lat,lng:pos.lng,type,severity:'medium',note:'أضيف تلقائيًا بواسطة حساس حركة الهاتف بعد عدم الرد',created_by:user.id,source:'sensor_auto'}).select().single()
    if(!error&&data){setBumps(x=>[data,...x]);setSelected(data)}
  }
  function cancelSensor(){setSensorPrompt(null)}
  function acceptSensor(){const s=sensorPrompt;if(!s)return;setSensorPrompt(null);setForm(f=>({...f,type:s.suggested}));setAdd(true)}

  return <div className="app">
    <header><div><b>مطبّك</b><small>تنبيه ذكي للمطبات والحفر</small></div><div className="actions"><button onClick={()=>setMuted(!muted)}>{muted?'🔇':'🔊'}</button><button onClick={()=>sensorOn?null:enableSensors()}>{sensorOn?'📳':'📱 حساس'}</button><button onClick={()=>user?supabase.auth.signOut():setLogin(true)}>{user?'خروج':'دخول'}</button><button onClick={()=>setAdmin(!admin)}>☰</button></div></header>
    <main><div id="map"/><section className="card"><div>📍 {pos?'GPS متصل':'في انتظار GPS'}</div><div className={sensorOn?'sensor ok':'sensor'}>📳 {sensorStatus}</div>{near?<><strong>{Math.round(near.d)} م</strong><span>{TYPES[near.b.type]||near.b.type}</span></>:<span>لا يوجد مطب قريب</span>}</section>
      <button className="fab" onClick={()=>setAdd(true)}>＋ إضافة</button>
      {sensorPrompt&&<section className="sensor-prompt"><div className="shock">📳</div><h3>تم رصد حركة مفاجئة</h3><p>هل كانت <b>{sensorPrompt.suggested==='pothole'?'حفرة':'مطبًا'}</b>؟</p><small>إذا لم تختر خلال {sensorPrompt.seconds} ثوانٍ سيتم الإضافة تلقائيًا كـ {TYPES[sensorPrompt.suggested]}.</small><div><button className="primary" onClick={acceptSensor}>نعم، أضفها</button><button onClick={cancelSensor}>إلغاء</button></div></section>}
      {selected&&<section className="sheet"><button onClick={()=>setSelected(null)}>✕</button><h3>{selected.type==='pothole'?'🕳️':'⚠️'} {TYPES[selected.type]}</h3><p>{selected.note||'لا توجد ملاحظات'}</p><small>الثقة {Math.round((selected.confidence||.5)*100)}% · تأكيد {selected.confirmations||0} · بلاغ {selected.reports||0}</small><div><button onClick={()=>vote('confirm')}>✓ موجود</button><button onClick={()=>vote('report')}>✕ غير موجود</button></div></section>}
      {(add||login)&&<div className="overlay"><div className="modal"><button onClick={()=>{setAdd(false);setLogin(false)}}>✕</button>{add?<><h2>إضافة موقع</h2><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(TYPES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select><select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}>{Object.entries(SEVERITY).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select><textarea placeholder="ملاحظة" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/><button className="primary" onClick={()=>addBump()}>حفظ</button></>:<><h2>{mode==='login'?'تسجيل الدخول':'إنشاء حساب'}</h2><input placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="كلمة المرور" value={pass} onChange={e=>setPass(e.target.value)}/><button className="primary" onClick={auth}>{mode==='login'?'دخول':'إنشاء حساب'}</button><button onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'إنشاء حساب':'تسجيل الدخول'}</button></>}</div></div>}
      {admin&&<aside className="admin"><h3>لوحة الإدارة</h3><p>المطبات النشطة: <b>{bumps.length}</b></p><p>الحساس: {sensorOn?'يعمل':'متوقف'}</p><p className="hint">قبل النشر العام يجب تفعيل RLS وصلاحيات المدير ومراجعة البلاغات.</p></aside>}
    </main>
  </div>
}
createRoot(document.getElementById('root')).render(<App/>)
