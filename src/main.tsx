import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import bs58 from 'bs58';
import {
  Activity, AlertTriangle, ArrowLeftRight, Check, ChevronRight, CircleDot, Copy, Database,
  ExternalLink, Eye, EyeOff, Gauge, KeyRound, Link2, LockKeyhole, LogOut, RefreshCw, Search,
  Server, ShieldCheck, TerminalSquare, UserRound, Wallet, WalletCards, X, Zap
} from 'lucide-react';
import './styles.css';

const LOCAL_WEB = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = import.meta.env.VITE_API_URL || (LOCAL_WEB ? 'http://localhost:8080' : '');
const SIGNER = import.meta.env.VITE_SIGNER_URL || (LOCAL_WEB ? 'http://localhost:8081' : '');

type WalletRow = { id:string; slot:number; mode:string; address:string; status:string; sol_lamports:string; updated_at:string };
type Toast = { id:number; kind:'ok'|'error'; text:string };

function short(value?: string, a=5, b=5) { if (!value) return '—'; return value.length > a+b+2 ? `${value.slice(0,a)}…${value.slice(-b)}` : value; }
function sol(lamports?: string) { try { return (Number(BigInt(lamports || '0')) / 1e9).toLocaleString(undefined,{maximumFractionDigits:5}); } catch { return '0'; } }
function time(value?: string) { if (!value) return 'Never'; const d=new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleString(); }
function cls(...v:(string|false|undefined)[]) { return v.filter(Boolean).join(' '); }

async function request(path:string, options:RequestInit={}, token?:string) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('content-type') && options.body) headers.set('content-type','application/json');
  if (token) headers.set('authorization',`Bearer ${token}`);
  const res = await fetch(`${API}${path}`, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
  return data;
}

function App() {
  const [area,setArea]=useState<'portal'|'admin'>(()=>location.hash.startsWith('#admin')?'admin':'portal');
  const [toasts,setToasts]=useState<Toast[]>([]);
  const notify=(text:string,kind:'ok'|'error'='ok')=>{ const id=Date.now(); setToasts(t=>[...t,{id,kind,text}]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200); };
  useEffect(()=>{ const fn=()=>setArea(location.hash.startsWith('#admin')?'admin':'portal'); addEventListener('hashchange',fn); return()=>removeEventListener('hashchange',fn);},[]);
  return <>
    {area==='portal'?<Portal notify={notify}/>:<Admin notify={notify}/>} 
    <div className="toasts">{toasts.map(t=><div key={t.id} className={cls('toast',t.kind)}>{t.kind==='ok'?<Check size={16}/>:<AlertTriangle size={16}/>} {t.text}</div>)}</div>
  </>;
}

function Brand({admin=false}:{admin?:boolean}) { return <div className="brand"><div className="brandMark"><ArrowLeftRight size={18}/></div><div><strong>TRADEGRID</strong><span>{admin?'CONTROL':'WALLET'}</span></div></div>; }

function Portal({notify}:{notify:(s:string,k?:'ok'|'error')=>void}) {
  const [token,setToken]=useState(()=>sessionStorage.getItem('portalToken')||'');
  const [robloxUserId,setRobloxUserId]=useState(()=>sessionStorage.getItem('robloxUserId')||'');
  const [code,setCode]=useState(''); const [message,setMessage]=useState('');
  const [wallets,setWallets]=useState<WalletRow[]>([]); const [busy,setBusy]=useState(false);
  const [portfolio,setPortfolio]=useState<any>(null); const [selectedWallet,setSelectedWallet]=useState<string>('');
  const [importOpen,setImportOpen]=useState(false);

  const loadWallets=async(t=token)=>{ if(!t)return; try { const d=await request('/v1/portal/wallets',{},t); setWallets(d.wallets||[]); } catch(e:any){ if(String(e.message).includes('AUTH')) logout(); } };
  useEffect(()=>{loadWallets();},[token]);
  const login=async()=>{ setBusy(true); try { const d=await request('/v1/portal/session',{method:'POST',body:JSON.stringify({code})}); setToken(d.token); setRobloxUserId(d.robloxUserId); setMessage(d.message); sessionStorage.setItem('portalToken',d.token); sessionStorage.setItem('robloxUserId',d.robloxUserId); notify('Roblox account verified'); } catch(e:any){notify(e.message,'error')} finally{setBusy(false)} };
  const logout=()=>{setToken('');setRobloxUserId('');setWallets([]);setMessage('');sessionStorage.removeItem('portalToken');sessionStorage.removeItem('robloxUserId');};
  const firstFree=useMemo(()=>[1,2,3,4,5].find(s=>!wallets.some(w=>w.slot===s)),[wallets]);
  const copy=async(v:string)=>{await navigator.clipboard.writeText(v);notify('Copied to clipboard')};
  const createManaged=async(slot:number)=>{try{setBusy(true); await request('/v1/portal/managed-wallet',{method:'POST',body:JSON.stringify({slot})},token); await loadWallets();notify(`Managed wallet created in slot ${slot}`)}catch(e:any){notify(e.message,'error')}finally{setBusy(false)}};
  const connectWallet=async(providerKind:'phantom'|'solflare',slot:number)=>{
    try{
      setBusy(true);
      const provider:any = providerKind==='phantom' ? (window as any).phantom?.solana || (window as any).solana : (window as any).solflare;
      if(!provider) throw new Error(`${providerKind==='phantom'?'Phantom':'Solflare'} is not installed`);
      const connected=await provider.connect();
      const publicKey=(connected?.publicKey||provider.publicKey)?.toString();
      if(!publicKey) throw new Error('WALLET_CONNECTION_FAILED');
      if(!message || !code) throw new Error('Generate a fresh Roblox link code before linking a wallet');
      const encoded=new TextEncoder().encode(message);
      const signed=await provider.signMessage(encoded,'utf8');
      const sigBytes=signed.signature || signed;
      await request('/v1/portal/link-wallet',{method:'POST',headers:{'x-wallet-slot':String(slot)},body:JSON.stringify({code,walletAddress:publicKey,signatureBase58:bs58.encode(sigBytes),message})},token);
      await loadWallets(); notify(`${providerKind==='phantom'?'Phantom':'Solflare'} linked to slot ${slot}`);
    } catch(e:any){notify(e.message,'error')} finally {setBusy(false)}
  };
  const showPortfolio=async(id:string)=>{ try{setSelectedWallet(id); const d=await request(`/v1/portal/portfolio/${id}`,{},token);setPortfolio(d)}catch(e:any){notify(e.message,'error')} };

  if(!token) return <div className="shell portalShell">
    <header><Brand/><a href="#admin" className="quietLink">Admin <ChevronRight size={14}/></a></header>
    <main className="loginGrid"><section className="heroPane"><div className="eyebrow"><ShieldCheck size={14}/> SECURE SOLANA ACCESS</div><h1>Your trading wallet,<br/><em>connected to Roblox.</em></h1><p>Link an external wallet or create a managed trading wallet. Private keys never pass through the Roblox client.</p><div className="trustRow"><span><LockKeyhole/>Signed ownership</span><span><Server/>Server verified</span><span><KeyRound/>Isolated signer</span></div></section>
    <section className="loginCard"><div className="cardIcon"><Link2/></div><h2>Connect your game account</h2><p>In Roblox, request a wallet link code. Enter the six digits below before it expires.</p><label>ROBLOX LINK CODE</label><div className="codeInput"><input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>e.key==='Enter'&&code.length===6&&login()}/></div><button className="primary" disabled={busy||code.length!==6} onClick={login}>{busy?<RefreshCw className="spin"/>:<ArrowLeftRight/>} Verify account</button><div className="securityNote"><LockKeyhole size={15}/><span>The link code only identifies your Roblox account. It cannot move funds.</span></div></section></main>
  </div>;

  return <div className="shell dashboardShell">
    <header><Brand/><div className="headActions"><div className="userChip"><UserRound size={15}/><span>Roblox {robloxUserId}</span></div><button className="iconButton" onClick={logout}><LogOut size={17}/></button></div></header>
    <main className="dash"><aside className="sideNav"><div className="navItem active"><WalletCards/>Wallets</div><div className="navItem"><Activity/>Activity</div><div className="navDivider"/><a className="navItem" href="#admin"><TerminalSquare/>Admin</a><div className="sideBottom"><span>API</span><b><i/> Connected</b></div></aside>
    <section className="content"><div className="pageTitle"><div><div className="eyebrow">ACCOUNT / WALLET MANAGEMENT</div><h1>Wallets</h1><p>Five wallet slots. External wallets require approval; managed wallets use the isolated signer.</p></div><button className="secondary" onClick={()=>loadWallets()}><RefreshCw size={16}/>Refresh</button></div>
    <div className="walletGrid">{[1,2,3,4,5].map(slot=>{const w=wallets.find(x=>x.slot===slot);return w?<WalletCard key={slot} w={w} onCopy={copy} onPortfolio={showPortfolio}/>:<EmptyWallet key={slot} slot={slot} disabled={busy} onManaged={createManaged} onConnect={connectWallet} onImport={()=>{setImportOpen(true)}}/>})}</div>
    {portfolio&&<section className="panel portfolioPanel"><div className="panelHead"><div><span className="mono">PORTFOLIO</span><h3>{short(portfolio.wallet.address,8,8)}</h3></div><button className="iconButton" onClick={()=>setPortfolio(null)}><X/></button></div><div className="portfolioStats"><div><span>SOL BALANCE</span><strong>{sol(portfolio.wallet.sol_lamports)} SOL</strong></div><div><span>TOKEN POSITIONS</span><strong>{portfolio.positions?.length||0}</strong></div></div><div className="tableWrap"><table><thead><tr><th>Token</th><th>Amount</th><th>Basis</th><th>Realized P&amp;L</th></tr></thead><tbody>{(portfolio.positions||[]).map((p:any)=><tr key={p.mint}><td className="mono">{short(p.mint,7,7)}</td><td>{p.amount_raw}</td><td>{p.basis_status}</td><td>{p.realized_pnl_quote_raw}</td></tr>)}{!portfolio.positions?.length&&<tr><td colSpan={4} className="emptyRow">No indexed token positions.</td></tr>}</tbody></table></div></section>}
    <section className="panel linkPanel"><div><div className="eyebrow">EXTERNAL WALLET LINK</div><h3>Need another ownership signature?</h3><p>For security, use a fresh six-digit link code from the Roblox server for each external wallet connection.</p></div><div className="linkCodeDisplay"><span>Current code</span><b>{code||'------'}</b></div></section>
    </section></main>
    {importOpen&&<ImportModal token={token} slot={firstFree||1} onClose={()=>setImportOpen(false)} onDone={async()=>{setImportOpen(false);await loadWallets();notify('Wallet imported')}} notify={notify}/>} 
  </div>;
}

function WalletCard({w,onCopy,onPortfolio}:{w:WalletRow;onCopy:(v:string)=>void;onPortfolio:(id:string)=>void}) { return <article className="walletCard"><div className="walletTop"><div className="slot">SLOT {w.slot}</div><span className={cls('status',w.status)}><i/>{w.status}</span></div><div className="walletIcon"><Wallet/></div><h3>{w.mode.replace('_',' ')}</h3><button className="address" onClick={()=>onCopy(w.address)}><span>{short(w.address,8,8)}</span><Copy size={14}/></button><div className="balance"><span>AVAILABLE BALANCE</span><strong>{sol(w.sol_lamports)} <small>SOL</small></strong></div><div className="walletFooter"><span>Updated {time(w.updated_at)}</span><button onClick={()=>onPortfolio(w.id)}>Portfolio <ChevronRight size={14}/></button></div></article>; }
function EmptyWallet({slot,disabled,onManaged,onConnect,onImport}:{slot:number;disabled:boolean;onManaged:(s:number)=>void;onConnect:(p:'phantom'|'solflare',s:number)=>void;onImport:()=>void}) { return <article className="walletCard emptyWallet"><div className="walletTop"><div className="slot">SLOT {slot}</div><span className="emptyTag">EMPTY</span></div><div className="plusWallet"><Wallet/></div><h3>Add a wallet</h3><p>Choose how this slot should connect to Solana.</p><div className="walletActions"><button disabled={disabled} onClick={()=>onConnect('phantom',slot)}><span className="walletDot phantom"/>Phantom</button><button disabled={disabled} onClick={()=>onConnect('solflare',slot)}><span className="walletDot solflare"/>Solflare</button><button disabled={disabled} onClick={()=>onManaged(slot)}><ShieldCheck size={15}/>Managed</button><button disabled={disabled} onClick={onImport}><KeyRound size={15}/>Import</button></div></article>; }

function ImportModal({token,slot,onClose,onDone,notify}:{token:string;slot:number;onClose:()=>void;onDone:()=>void;notify:(s:string,k?:'ok'|'error')=>void}) { const [key,setKey]=useState(''); const [show,setShow]=useState(false); const [busy,setBusy]=useState(false); const run=async()=>{try{setBusy(true);if(!SIGNER)throw new Error('Devnet import signer is not configured for this deployment');const s=await request('/v1/portal/import-session',{method:'POST',body:JSON.stringify({slot})},token);const r=await fetch(`${SIGNER}/v1/wallets/import`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),importToken:s.token,privateKeyBase58:key})});const d=await r.json();if(!r.ok)throw new Error(d.error||'IMPORT_FAILED');await request('/v1/portal/import-complete',{method:'POST',body:JSON.stringify({token:s.token,address:d.address,signerRef:d.signerRef})},token);setKey('');onDone()}catch(e:any){notify(e.message,'error')}finally{setBusy(false)}}; return <div className="modalBack"><div className="modal"><button className="modalClose" onClick={onClose}><X/></button><div className="dangerIcon"><KeyRound/></div><div className="eyebrow danger">DEVNET-ONLY SECURITY FLOW</div><h2>Import private key</h2><p>The browser sends this key directly to the isolated signer. It is never sent to the main API or Roblox.</p><div className="warning"><AlertTriangle/><span>Do not enable this flow on mainnet until the signer is moved to audited KMS/HSM infrastructure.</span></div><label>PRIVATE KEY (BASE58)</label><div className="secretInput"><input type={show?'text':'password'} value={key} onChange={e=>setKey(e.target.value)} autoComplete="off" spellCheck={false}/><button onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div><div className="modalActions"><button className="secondary" onClick={onClose}>Cancel</button><button className="dangerButton" disabled={busy||key.length<80} onClick={run}>{busy?<RefreshCw className="spin"/>:<KeyRound/>}Import to slot {slot}</button></div></div></div> }

function Admin({notify}:{notify:(s:string,k?:'ok'|'error')=>void}) {
  const [token,setToken]=useState(()=>sessionStorage.getItem('adminToken')||''); const [password,setPassword]=useState('');
  const [tab,setTab]=useState('overview'); const [data,setData]=useState<any>(null); const [busy,setBusy]=useState(false); const [queryText,setQueryText]=useState('');
  const adminReq=(path:string,opts:RequestInit={})=>request(path,opts,token);
  const load=async(target=tab)=>{if(!token)return;setBusy(true);try{let path=`/v1/admin/${target}`;if(['users','wallets','tokens'].includes(target)&&queryText)path+=`?q=${encodeURIComponent(queryText)}`;const d=await adminReq(path);setData(d)}catch(e:any){notify(e.message,'error');if(e.message.includes('AUTH')){setToken('');sessionStorage.removeItem('adminToken')}}finally{setBusy(false)}};
  useEffect(()=>{load();},[token,tab]);
  useEffect(()=>{if(tab==='overview'&&token){const i=setInterval(()=>load('overview'),10000);return()=>clearInterval(i)}},[token,tab]);
  const login=async()=>{try{setBusy(true);const d=await request('/v1/admin/session',{method:'POST',body:JSON.stringify({password})});setToken(d.token);sessionStorage.setItem('adminToken',d.token);setPassword('');notify('Admin session opened')}catch(e:any){notify(e.message,'error')}finally{setBusy(false)}};
  const mutate=async(path:string,body:any)=>{try{await adminReq(path,{method:'PATCH',body:JSON.stringify(body)});notify('Change applied and audited');await load()}catch(e:any){notify(e.message,'error')}};
  if(!token) return <div className="shell adminLogin"><header><Brand admin/><a href="#" className="quietLink">Wallet portal <ChevronRight size={14}/></a></header><main className="adminLoginMain"><section><div className="eyebrow danger"><LockKeyhole/> RESTRICTED ACCESS</div><h1>Backend control.<br/><em>No guesswork.</em></h1><p>Inspect the financial pipeline from database state through the signer and indexer. Every mutation exposed here is written to the audit log.</p></section><div className="loginCard darkCard"><div className="cardIcon red"><TerminalSquare/></div><h2>Administrator</h2><p>Use the dedicated admin password configured on the API service.</p><label>ADMIN PASSWORD</label><input className="normalInput" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/><button className="primary redPrimary" onClick={login} disabled={busy||password.length<1}>{busy?<RefreshCw className="spin"/>:<LockKeyhole/>}Open control panel</button></div></main></div>;
  const tabs=[['overview',Gauge],['users',UserRound],['wallets',Wallet],['trades',ArrowLeftRight],['tokens',CircleDot],['indexer',Zap],['audit',Database]] as const;
  return <div className="shell adminShell"><header><Brand admin/><div className="headActions"><span className="livePill"><i/>ADMIN LIVE</span><button className="iconButton" onClick={()=>{setToken('');sessionStorage.removeItem('adminToken')}}><LogOut/></button></div></header><main className="adminLayout"><aside className="adminNav"><div className="navLabel">CONTROL PLANE</div>{tabs.map(([id,Icon])=><button key={id} className={cls('adminNavItem',tab===id&&'active')} onClick={()=>{setTab(id);setQueryText('')}}><Icon/>{id}<ChevronRight/></button>)}<div className="navDivider"/><a className="adminNavItem" href="#"><WalletCards/>Wallet portal<ExternalLink/></a></aside><section className="adminContent"><div className="adminTop"><div><div className="eyebrow">BACKEND / {tab.toUpperCase()}</div><h1>{tab[0].toUpperCase()+tab.slice(1)}</h1></div><div className="adminTools">{['users','wallets','tokens'].includes(tab)&&<div className="search"><Search/><input placeholder={`Search ${tab}…`} value={queryText} onChange={e=>setQueryText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/></div>}<button className="secondary" onClick={()=>load()}><RefreshCw className={busy?'spin':''}/>Refresh</button></div></div>{busy&&!data?<div className="loader"><RefreshCw className="spin"/>Loading backend state…</div>:<AdminView tab={tab} data={data} mutate={mutate}/>}</section></main></div>;
}

function AdminView({tab,data,mutate}:{tab:string;data:any;mutate:(p:string,b:any)=>void}) {
  if(!data)return null;
  if(tab==='overview') { const s=data.services||{}; return <><div className="metricGrid"><Metric label="USERS" value={data.counts?.users||'0'} sub="registered Roblox users"/><Metric label="WALLETS" value={data.counts?.wallets||'0'} sub="across all five slots"/><Metric label="TRADES / 24H" value={data.trades24h||'0'} sub={`${data.failedTrades24h||0} failed`}/><Metric label="TOKENS" value={data.counts?.tokens||'0'} sub="indexed market assets"/></div><div className="adminGrid"><section className="panel"><PanelHead title="Service health" icon={<Activity/>}/><div className="serviceList"><Service name="API" d={s.api}/><Service name="PostgreSQL" d={s.database}/><Service name="Redis" d={s.redis}/><Service name="Signing service" d={s.signer}/></div></section><section className="panel"><PanelHead title="Runtime flags" icon={<ShieldCheck/>}/><div className="flagList">{Object.entries(data.flags||{}).map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><b className={v?'on':'off'}>{v?'ENABLED':'DISABLED'}</b></div>)}</div></section><section className="panel wide"><PanelHead title="Indexer checkpoint" icon={<Zap/>}/><div className="checkpoint"><div><span>ID</span><b>{data.lastIndexerCheckpoint?.id||'No checkpoint'}</b></div><div><span>SLOT</span><b>{data.lastIndexerCheckpoint?.slot||'—'}</b></div><div><span>LAST UPDATE</span><b>{time(data.lastIndexerCheckpoint?.updated_at)}</b></div><div><span>SIGNATURE</span><b className="mono">{short(data.lastIndexerCheckpoint?.signature,9,9)}</b></div></div></section></div></> }
  if(tab==='users') return <DataTable heads={['Roblox user','Wallets','Created','Last seen']} rows={(data.users||[]).map((u:any)=>[u.roblox_user_id,u.wallet_count,time(u.created_at),time(u.last_seen_at)])}/>;
  if(tab==='wallets') return <div className="tableWrap adminTable"><table><thead><tr><th>User</th><th>Slot</th><th>Address</th><th>Mode</th><th>SOL</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody>{(data.wallets||[]).map((w:any)=><tr key={w.id}><td>{w.roblox_user_id}</td><td>{w.slot}</td><td className="mono">{short(w.address,7,7)}</td><td>{w.mode}</td><td>{sol(w.sol_lamports)}</td><td><span className={cls('status',w.status)}><i/>{w.status}</span></td><td>{time(w.updated_at)}</td><td><button className={w.status==='disabled'?'miniButton':'miniButton dangerMini'} onClick={()=>mutate(`/v1/admin/wallets/${w.id}/status`,{status:w.status==='disabled'?'active':'disabled'})}>{w.status==='disabled'?'Enable':'Disable'}</button></td></tr>)}</tbody></table></div>;
  if(tab==='trades') return <div className="tableWrap adminTable"><table><thead><tr><th>Time</th><th>User</th><th>Side</th><th>Mint</th><th>Status</th><th>Route</th><th>Signature / error</th></tr></thead><tbody>{(data.trades||[]).map((t:any)=><tr key={t.id}><td>{time(t.created_at)}</td><td>{t.roblox_user_id}</td><td><b className={t.side==='buy'?'buy':'sell'}>{t.side}</b></td><td className="mono">{short(t.mint)}</td><td><span className={cls('tradeStatus',t.status)}>{t.status}</span></td><td>{t.market_kind||'—'}</td><td className="mono">{t.error_code?<span className="errorText">{t.error_code}: {t.error_message}</span>:short(t.tx_signature,7,7)}</td></tr>)}</tbody></table></div>;
  if(tab==='tokens') return <div className="tableWrap adminTable"><table><thead><tr><th>Token</th><th>Mint</th><th>State</th><th>Curve</th><th>Liquidity</th><th>Updated</th><th/></tr></thead><tbody>{(data.tokens||[]).map((t:any)=><tr key={t.mint}><td><b>{t.symbol||'—'}</b><small>{t.name||'Unknown'}</small></td><td className="mono">{short(t.mint,7,7)}</td><td><span className="tradeStatus">{t.state}</span></td><td>{t.curve_progress_bps!=null?(t.curve_progress_bps/100).toFixed(1)+'%':'—'}</td><td>{sol(t.liquidity_lamports)} SOL</td><td>{time(t.updated_at)}</td><td><button className={t.state==='quarantined'?'miniButton':'miniButton dangerMini'} onClick={()=>mutate(`/v1/admin/tokens/${t.mint}/state`,{state:t.state==='quarantined'?'active':'quarantined'})}>{t.state==='quarantined'?'Release':'Quarantine'}</button></td></tr>)}</tbody></table></div>;
  if(tab==='indexer') return <div className="adminGrid"><section className="panel wide"><PanelHead title="Checkpoints" icon={<Zap/>}/><DataTable heads={['ID','Slot','Signature','Updated']} rows={(data.checkpoints||[]).map((c:any)=>[c.id,c.slot,short(c.signature,8,8),time(c.updated_at)])}/></section></div>;
  if(tab==='audit') return <div className="tableWrap adminTable"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{(data.events||[]).map((e:any)=><tr key={e.id}><td>{time(e.created_at)}</td><td>{e.actor_type}{e.actor_id?` / ${e.actor_id}`:''}</td><td className="mono">{e.action}</td><td>{e.target_type||'—'} {short(e.target_id)}</td><td className="mono jsonCell">{JSON.stringify(e.details)}</td></tr>)}</tbody></table></div>;
  return null;
}
function Metric({label,value,sub}:{label:string;value:string;sub:string}) { return <div className="metric"><span>{label}</span><strong>{Number(value).toLocaleString()}</strong><small>{sub}</small></div> }
function Service({name,d}:{name:string;d:any}) { return <div className="service"><span className={d?.ok?'healthDot':'healthDot bad'}/><div><b>{name}</b><small>{d?.ok?'Operational':'Unavailable'}</small></div><em>{d?.latencyMs!=null?`${d.latencyMs} ms`:d?.ok?'LIVE':'—'}</em></div> }
function PanelHead({title,icon}:{title:string;icon:React.ReactNode}) { return <div className="panelHead"><h3>{icon}{title}</h3></div> }
function DataTable({heads,rows}:{heads:string[];rows:any[][]}) { return <div className="tableWrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={heads.length} className="emptyRow">No records.</td></tr>}</tbody></table></div> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
