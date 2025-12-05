import React, { useEffect, useState } from "react";

const backendBase = import.meta.env.VITE_BACKEND_BASE || "http://localhost:3000";
const socketToken = import.meta.env.VITE_SOCKET_SECRET || "";

function IconMenu() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconChevronRight() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function Badge({ children, color = "gray" }) {
    const bg = {
        green: "bg-emerald-50 text-emerald-700",
        red: "bg-rose-50 text-rose-700",
        yellow: "bg-amber-50 text-amber-700",
        gray: "bg-slate-100 text-slate-700"
    }[color] || "bg-slate-100 text-slate-700";
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg}`}>{children}</span>;
}

export default function App() {
    const [collapsed, setCollapsed] = useState(false);
    const [url, setUrl] = useState("");
    const [message, setMessage] = useState("Olá, webhook!");
    const [subs, setSubs] = useState([]);
    const [logs, setLogs] = useState([]);
    const [statusMsg, setStatusMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const s = localStorage.getItem("sidebar-collapsed");
        setCollapsed(s === "1");
    }, []);

    useEffect(() => {
        localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
    }, [collapsed]);

    useEffect(() => {
        fetchSubscribers();
        fetchLogs();
        const iv = setInterval(fetchLogs, 8000);
        let socket = null;
        if (window.io) {
            try {
                socket = window.io(backendBase, { auth: { token: socketToken } });
                socket.on("logs", (initial) => setLogs(initial || []));
                socket.on("log", (log) => setLogs((prev) => [log, ...prev].slice(0, 200)));
            } catch (err) {
                console.error(err);
            }
        }
        return () => {
            if (socket) socket.disconnect();
            clearInterval(iv);
        };
    }, []);

    async function fetchSubscribers() {
        try {
            const r = await fetch(`${backendBase}/subscribers`);
            const j = await r.json();
            setSubs(j.subscribers || []);
            setStatusMsg("");
        } catch (err) {
            setStatusMsg("Erro ao buscar assinantes");
        }
    }

    async function fetchLogs() {
        try {
            const r = await fetch(`${backendBase}/logs`);
            const j = await r.json();
            setLogs(j.logs || []);
        } catch (err) {}
    }

    async function subscribe() {
        if (!url) {
            setStatusMsg("Informe uma URL.");
            return;
        }
        setLoading(true);
        setStatusMsg("Enviando inscrição...");
        try {
            const res = await fetch(`${backendBase}/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setStatusMsg(`Erro: ${res.status} ${body?.error || ""}`);
                setLoading(false);
                return;
            }
            setStatusMsg(`Inscrição: ${body?.subscriber?.status || "ok"}`);
            setUrl("");
            fetchSubscribers();
        } catch (err) {
            setStatusMsg("Erro de rede ao inscrever.");
        } finally {
            setLoading(false);
        }
    }

    async function trigger() {
        setStatusMsg("Disparando evento...");
        try {
            await fetch(`${backendBase}/event`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            setStatusMsg("Evento enviado.");
            fetchLogs();
        } catch (err) {
            setStatusMsg("Erro ao disparar evento.");
        }
    }

    async function removeSubscriber(id) {
        if (!confirm("Remover assinante?")) return;
        try {
            await fetch(`${backendBase}/subscribers/${id}`, { method: "DELETE" });
            setStatusMsg("Assinante removido.");
            fetchSubscribers();
        } catch (err) {
            setStatusMsg("Erro ao remover assinante.");
        }
    }

    function statusBadge(status) {
        if (status === "verified") return <Badge color="green">verified</Badge>;
        if (status === "pending") return <Badge color="yellow">pending</Badge>;
        return <Badge color="gray">{status}</Badge>;
    }

    return (
        <div className="min-h-screen flex bg-base-200">
            <aside
                className={`flex flex-col bg-base-100 transition-all duration-300 ease-in-out shadow-md ${collapsed ? "w-20" : "w-72"} overflow-hidden`}
                aria-expanded={!collapsed}
            >
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            className="btn btn-ghost btn-sm p-2"
                            onClick={() => setCollapsed((c) => !c)}
                            aria-label="toggle menu"
                        >
                            {collapsed ? <IconChevronRight /> : <IconMenu />}
                        </button>
                        {!collapsed && <h2 className="text-lg font-semibold">Webhook Manager</h2>}
                    </div>
                </div>

                <nav className="flex-1 px-2 py-3 space-y-2">
                    <button className="w-full btn btn-ghost justify-start gap-3" onClick={() => window.scrollTo(0, 0)}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                        {!collapsed && <span>Dashboard</span>}
                    </button>

                    <button className="w-full btn btn-ghost justify-start gap-3" onClick={fetchSubscribers}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                        {!collapsed && <span>Atualizar assinantes</span>}
                    </button>

                    <button className="w-full btn btn-ghost justify-start gap-3" onClick={fetchLogs}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                        {!collapsed && <span>Atualizar logs</span>}
                    </button>
                </nav>

                <div className="p-3 border-t border-base-200">
                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-ghost btn-sm w-full"
                            onClick={() => {
                                const el = document.documentElement;
                                const current = el.classList.contains("dark") ? "dark" : "light";
                                if (current === "dark") {
                                    el.classList.remove("dark");
                                    el.setAttribute("data-theme", "light");
                                    localStorage.setItem("theme", "light");
                                } else {
                                    el.classList.add("dark");
                                    el.setAttribute("data-theme", "dark");
                                    localStorage.setItem("theme", "dark");
                                }
                            }}
                        >
                            {!collapsed ? "Tema" : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>}
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 p-6">
                <header className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold">Webhook Manager</h1>
                        <p className="text-sm text-base-content/70">Painel • Backend: {backendBase}</p>
                    </div>
                    <div className="text-sm text-base-content/70">Status: <span className="font-medium">{statusMsg || "idle"}</span></div>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="lg:col-span-2">
                        <div className="card bg-base-100 p-6 rounded-lg shadow">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-medium">Inscrever URL</h2>
                                    <p className="text-sm text-base-content/70">Adicione a URL do endpoint que receberá webhooks.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <input className="input input-bordered w-full" placeholder="http://receiver:4000/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
                                <button onClick={subscribe} disabled={loading} className="btn btn-primary">{loading ? "Enviando..." : "Inscrever"}</button>
                            </div>

                            <div className="mt-3 text-sm text-base-content/70">Dica: use <code className="bg-base-200 px-1 rounded">http://receiver:4000/webhook</code> com Docker Compose.</div>
                        </div>

                        <div className="card bg-base-100 p-6 rounded-lg shadow mt-6">
                            <h3 className="text-lg font-medium mb-3">Assinantes</h3>
                            {subs.length === 0 ? <div className="text-center py-8 text-slate-400">Nenhum assinante cadastrado</div> : (
                                <ul className="space-y-3">
                                    {subs.map((s) => (
                                        <li key={s.id} className="border rounded p-3 flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium text-base-content">{s.url}</div>
                                                    <div>{statusBadge(s.status)}</div>
                                                </div>
                                                <div className="text-xs text-base-content/70 mt-1">Criado: {s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(s)}>Detalhes</button>
                                                <button className="btn btn-ghost btn-error btn-sm" onClick={() => removeSubscriber(s.id)}>Remover</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <aside className="space-y-6">
                        <div className="card bg-base-100 p-6 rounded-lg shadow">
                            <h3 className="font-medium mb-2">Disparar evento</h3>
                            <input value={message} onChange={(e) => setMessage(e.target.value)} className="input input-bordered w-full mb-3" />
                            <button onClick={trigger} className="btn btn-success w-full">Disparar</button>
                        </div>

                        <div className="card bg-base-100 p-6 rounded-lg shadow">
                            <h3 className="font-medium mb-2">Logs (ao vivo)</h3>
                            <div className="max-h-48 overflow-auto text-sm">
                                {logs.length === 0 ? <div className="text-center py-8 text-slate-400">Nenhum log</div> : (
                                    <ul className="space-y-3">
                                        {logs.slice(0, 30).map((l) => (
                                            <li key={l.id} className="border rounded p-2">
                                                <div className="text-xs text-base-content/70">{l.time ? new Date(l.time).toLocaleString() : "-"}</div>
                                                <div className="text-sm mt-1 font-medium">{l.url}</div>
                                                <div className="text-xs mt-1">Resultado: {l.result?.success ? "ok" : "erro"}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </aside>
                </section>

                <footer className="text-center text-xs text-base-content/70 mt-8">Projeto de Webhook • Desenvolvido localmente</footer>
            </main>

            {selected && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
                    <div className="bg-base-100 rounded-lg p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium">Assinante</h3>
                            <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm">Fechar</button>
                        </div>
                        <div className="text-sm text-base-content/80">
                            <div className="mb-2"><strong>URL:</strong> {selected.url}</div>
                            <div className="mb-2"><strong>Status:</strong> {selected.status}</div>
                            <div className="mb-2"><strong>Challenge:</strong> <code className="bg-base-200 px-1 rounded">{selected.challenge}</code></div>
                            <div className="mb-2"><strong>Criado em:</strong> {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "-"}</div>
                        </div>
                        <div className="mt-4 text-right">
                            <button onClick={() => setSelected(null)} className="px-4 py-2 btn btn-outline">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
