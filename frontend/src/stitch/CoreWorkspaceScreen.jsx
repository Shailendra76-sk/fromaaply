import React, { useRef } from 'react';
import LiveBrowserCanvas from '../LiveBrowserCanvas.tsx';

function StatusPill({ label, value, tone = '' }) {
  return <div className={`fw-focus-pill ${tone}`}><span>{label}</span><b>{value}</b></div>;
}

export default function CoreWorkspaceScreen({
  apiBase, userId, accessToken, workflow, instruction, setInstruction, busy, status, docs,
  onStart, onConfirm, onOpen, onUpload, onExtract, onApprove, onFill, onFinalApproval, onFinalSubmit,
  approval, screenshot, onHumanGate, onLiveControl, resumeRequest,
}) {
  const uploadRef = useRef(null);
  const fills = workflow?.plan?.fills || [];
  const approvals = workflow?.fieldApprovals || {};
  const facts = workflow?.research?.facts || {};
  const human = workflow?.plan?.human_required || workflow?.result?.human_required || [];
  const progress = workflow?.state === 'final_review' ? 92 : workflow?.session_id ? 68 : workflow ? 36 : 0;
  const submitPrompt = event => {
    event.preventDefault();
    if (!busy && instruction.trim().length >= 3) onStart();
  };

  return <div className="fw-focus-workspace">
    <header className="fw-focus-header">
      <div>
        <div className="fw-focus-eyebrow">FORMWISE WORKSPACE</div>
        <h1>{workflow?.session_id ? 'Your form is being prepared' : 'What do you want to fill today?'}</h1>
        <p>{workflow?.session_id ? 'Watch the live form below. Formwise pauses whenever your confirmation is needed.' : 'Ask Formwise to prepare a form using your approved documents.'}</p>
      </div>
      <div className="fw-focus-status"><i /> {busy ? 'Working' : workflow?.state ? workflow.state.replaceAll('_', ' ') : 'Ready'}</div>
    </header>

    <section className="fw-focus-summary" aria-label="Workspace status">
      <StatusPill label="Progress" value={progress ? `${progress}%` : 'Not started'} />
      <StatusPill label="Documents" value={`${docs.length} attached`} />
      <StatusPill label="Security" value="Human approval" tone="safe" />
      {workflow?.session_id && <StatusPill label="Session" value={`#${workflow.session_id}`} />}
    </section>

    <main className="fw-form-stage">
      <div className="fw-form-stage-head">
        <div><span className="fw-focus-eyebrow">LIVE FORM</span><strong>{workflow?.session_id ? `Session #${workflow.session_id}` : 'Your form will appear here'}</strong></div>
        <span className="fw-live-indicator"><i /> {workflow?.session_id ? 'LIVE VIEW' : 'WAITING'}</span>
      </div>
      {workflow?.session_id
        ? <LiveBrowserCanvas apiBase={apiBase} userId={userId} accessToken={accessToken} sessionId={workflow.session_id} onStatus={() => {}} onHumanGate={onHumanGate} onLiveControl={onLiveControl} resumeRequest={resumeRequest} />
        : <div className="fw-form-empty"><div className="fw-form-empty-icon">⌁</div><h2>Live form filling screen</h2><p>Start a request below. The website and every field Formwise fills will be visible here.</p><div className="fw-empty-steps"><span><b>1</b> Ask</span><span><b>2</b> Review</span><span><b>3</b> Approve</span></div></div>}

      {workflow?.state === 'research_ready' && <div className="fw-focus-alert"><b>Review the application details before continuing</b><p>{facts.application_window || 'Application window not extracted'} · Last date: {facts.last_date || 'Not extracted'} · Fee: {facts.fee_rupees ? `₹${facts.fee_rupees}` : 'Not extracted'}</p><div className="fw-focus-actions"><button onClick={() => onConfirm(true)} disabled={busy}>Continue after review</button><button className="quiet" onClick={() => onConfirm(false)} disabled={busy}>Cancel</button></div></div>}
      {workflow?.state === 'documents_missing' && <div className="fw-focus-alert warning"><b>Some documents are still required</b><p>Attach the missing document below, then re-check the list.</p><button onClick={() => onConfirm(true)} disabled={busy}>Re-check documents</button></div>}
      {workflow?.state === 'documents_ready' && <div className="fw-focus-alert"><b>Your documents are ready</b><p>The target application can now be opened in the live screen.</p><button onClick={onOpen} disabled={busy}>Open form</button></div>}

      {workflow && <section className="fw-review-strip">
        <div className="fw-review-title"><div><span className="fw-focus-eyebrow">REVIEW QUEUE</span><strong>{fills.length ? `${fills.length} fields detected` : 'Preparing fields'}</strong></div><span>{human.length ? `${human.length} human step${human.length > 1 ? 's' : ''}` : 'No human step yet'}</span></div>
        {fills.length > 0 && <div className="fw-field-list">{fills.slice(0, 4).map(item => <div className="fw-focus-field" key={item.index}><div><span>{item.field}</span><b>{item.requires_approval ? 'Needs approval' : 'Verified'}</b></div><p>{String(item.value ?? '').slice(0, 48) || 'Value ready'}</p>{item.requires_approval && !approvals[item.index] && <button onClick={() => onApprove(item)} disabled={busy}>Approve</button>}</div>)}</div>}
        <div className="fw-review-actions">{workflow.state === 'documents_ready' && <button onClick={onOpen} disabled={busy}>Inspect form</button>}<button className="fw-primary-action" onClick={onFill} disabled={busy || !fills.length}>Fill approved fields</button></div>
      </section>}

      {workflow?.state === 'final_review' && <div className="fw-focus-alert review"><b>Final review required</b><p>Check the completed form and screenshot carefully. Formwise will not click the final Submit button.</p>{screenshot && <img className="fw-review-shot" src={screenshot} alt="Latest form screenshot" />}<div className="fw-focus-actions"><button onClick={onFinalApproval} disabled={busy}>Show manual submit instructions</button>{approval && <button className="fw-primary-action" onClick={onFinalSubmit} disabled={busy}>I will submit manually</button>}</div></div>}
      {status && <div className="fw-focus-status-line"><i /> {status}</div>}
    </main>

    <form className="fw-composer" onSubmit={submitPrompt}>
      <div className="fw-composer-top"><span className="fw-composer-label">Ask Formwise</span><span className="fw-composer-hint">Your data stays private and needs your approval</span></div>
      <div className="fw-composer-row">
        <button type="button" className="fw-attach-button" onClick={() => uploadRef.current?.click()} aria-label="Attach document or photo">+</button>
        <input ref={uploadRef} className="fw-hidden" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onUpload} />
        <input className="fw-composer-input" aria-label="Ask Formwise" placeholder="Search a form or tell me what you need…" value={instruction} onChange={event => setInstruction(event.target.value)} />
        <button type="submit" className="fw-send-button" disabled={busy || instruction.trim().length < 3}>{busy ? 'Working…' : workflow ? 'Continue' : 'Start'}</button>
      </div>
      <div className="fw-composer-bottom"><span>+ Add document or photo</span><span>Enter to send</span>{docs.length > 0 && <span className="fw-attached-count">{docs.length} document{docs.length > 1 ? 's' : ''} ready</span>}</div>
    </form>
  </div>;
}
