export const GALLERY_CSS_FILENAME = "evidence-gallery.css";

/** Standalone gallery styles (ev-* classes), independent of the Tailwind theme. */
export const GALLERY_CSS = `.ev-gallery { font-family: inherit; }
.ev-summary { display: flex; flex-wrap: wrap; gap: 1rem; align-items: baseline; margin-bottom: 1rem; color: #475569; }
.ev-summary strong { color: #0f172a; }
.ev-filters { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
.ev-filter { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 9999px; padding: 0.25rem 0.9rem; font-size: 0.85rem; cursor: pointer; }
.ev-filter.is-active { background: #0f172a; color: #fff; border-color: #0f172a; }
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.ev-card { text-align: left; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #fff; padding: 0; cursor: pointer; overflow: hidden; transition: box-shadow 0.15s; }
.ev-card:hover { box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12); }
.ev-thumb { aspect-ratio: 16 / 10; background: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ev-thumb img { width: 100%; height: 100%; object-fit: cover; }
.ev-card-body { padding: 0.75rem 0.9rem; }
.ev-card-title { font-weight: 600; color: #0f172a; margin: 0 0 0.25rem; font-size: 0.95rem; }
.ev-card-shows { color: #64748b; font-size: 0.8rem; margin: 0.35rem 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ev-badge { display: inline-block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 9999px; padding: 0.1rem 0.55rem; }
.ev-badge-passed { background: #dcfce7; color: #166534; }
.ev-badge-failed { background: #fee2e2; color: #991b1b; }
.ev-missing { color: #b91c1c; background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 0.375rem; padding: 2rem 1rem; text-align: center; font-size: 0.85rem; width: 100%; }
.ev-modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.ev-modal[hidden] { display: none; }
.ev-modal-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.6); border: 0; padding: 0; cursor: pointer; }
.ev-modal-panel { position: relative; background: #fff; border-radius: 0.75rem; max-width: 960px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem 1.75rem; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3); }
.ev-modal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
.ev-modal-title { margin: 0; font-size: 1.25rem; color: #0f172a; }
.ev-modal-close { border: 0; background: transparent; font-size: 1.4rem; line-height: 1; cursor: pointer; color: #64748b; }
.ev-modal-close:hover { color: #0f172a; }
.ev-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
.ev-tab { border: 1px solid #cbd5e1; background: #fff; border-radius: 0.375rem; padding: 0.3rem 0.7rem; font-size: 0.8rem; cursor: pointer; display: inline-flex; gap: 0.4rem; align-items: center; }
.ev-tab.is-active { border-color: #0f172a; box-shadow: inset 0 0 0 1px #0f172a; }
.ev-modal-shot img { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.375rem; }
.ev-prose dt { font-weight: 600; color: #0f172a; margin-top: 0.9rem; font-size: 0.85rem; }
.ev-prose dd { margin: 0.2rem 0 0; color: #334155; font-size: 0.9rem; }
.ev-prose code { background: #f1f5f9; border-radius: 0.25rem; padding: 0.1rem 0.35rem; font-size: 0.8rem; }
.ev-modal-actions { margin-top: 1.25rem; display: flex; justify-content: flex-end; }
.ev-copy { border: 1px solid #cbd5e1; background: #fff; border-radius: 0.375rem; padding: 0.4rem 0.9rem; font-size: 0.85rem; cursor: pointer; }
.ev-copy:hover { background: #f8fafc; }
body.ev-locked { overflow: hidden; }
`;
