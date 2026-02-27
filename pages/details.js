import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export default function DetailsPage() {
  const router = useRouter();
  const id = router.query.id;

  const [ledger, setLedger] = useState(null);
  const [entries, setEntries] = useState([]);

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editLedgerModalOpen, setEditLedgerModalOpen] = useState(false);

  const [editingSubId, setEditingSubId] = useState("");
  const [subDate, setSubDate] = useState(getTodayDate());
  const [particular, setParticular] = useState("");
  const [remarks, setRemarks] = useState("");
  const [received, setReceived] = useState("");
  const [paid, setPaid] = useState("");
  const [isDr, setIsDr] = useState(true);

  const [ledgerParty, setLedgerParty] = useState("");
  const [ledgerDate, setLedgerDate] = useState(getTodayDate());
  const [ledgerCategory, setLedgerCategory] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("");

  async function loadLedger() {
    const res = await fetch(`/ledger/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setLedger(data);

    setLedgerParty(data.partyLedger || "");
    setLedgerDate(data.date ? data.date.split("T")[0] : getTodayDate());
    setLedgerCategory(data.category || "");
    setLedgerStatus(data.status || "");
  }

  async function loadSubEntries() {
    const res = await fetch(`/sub-entries/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    setEntries(data);
  }

  useEffect(() => {
    if (!router.isReady || !id) return;
    loadLedger();
    loadSubEntries();
  }, [router.isReady, id]);

  function openCreateSubEntry() {
    setEditingSubId("");
    setSubDate(getTodayDate());
    setParticular("");
    setRemarks("");
    setReceived("");
    setPaid("");
    setIsDr(true);
    setSubModalOpen(true);
  }

  function openEditSubEntry(entry) {
    setEditingSubId(entry._id);
    setSubDate((entry.date || "").split("T")[0]);
    setParticular(entry.particular || "");
    setRemarks(entry.remarks || "");

    if (Number(entry.paid || 0) > 0) {
      setIsDr(true);
      setPaid(String(entry.paid || ""));
      setReceived("");
    } else {
      setIsDr(false);
      setReceived(String(entry.received || ""));
      setPaid("");
    }

    setSubModalOpen(true);
  }

  async function submitSubEntry(e) {
    e.preventDefault();
    const payload = {
      parentId: id,
      date: subDate,
      particular,
      remarks,
      received: isDr ? 0 : Number(received || 0),
      paid: isDr ? Number(paid || 0) : 0,
    };

    const endpoint = editingSubId ? `/sub-entry/${editingSubId}` : "/sub-entry";
    const method = editingSubId ? "PUT" : "POST";

    await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubModalOpen(false);
    await loadSubEntries();
  }

  async function deleteSubEntry(subId) {
    await fetch(`/sub-entry/${subId}`, { method: "DELETE" });
    await loadSubEntries();
  }

  async function saveLedger(e) {
    e.preventDefault();
    await fetch(`/ledger/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyLedger: ledgerParty,
        date: ledgerDate,
        category: ledgerCategory,
        status: ledgerStatus,
      }),
    });

    setEditLedgerModalOpen(false);
    await loadLedger();
  }

  async function deleteLedger() {
    if (!confirm("Are you sure you want to delete this ledger and all its subentries?")) {
      return;
    }

    await fetch(`/sub-entries/${id}`, { method: "DELETE" });
    await fetch(`/request/${id}`, { method: "DELETE" });
    router.push("/");
  }

  const rowsWithBalance = useMemo(() => {
    let runningBalance = 0;
    return entries.map((entry) => {
      const cr = Number(entry.received || 0);
      const dr = Number(entry.paid || 0);
      runningBalance += cr - dr;
      return { entry, cr, dr, runningBalance };
    });
  }, [entries]);

  return (
    <>
      <Head>
        <title>Ledger Details</title>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </Head>

      <div>
        <a href="/" className="back_arrow">
          <i className="fas fa-arrow-left right" />
          Ledger Entries
        </a>
      </div>

      <div className="text_btn_alignment">
        <div className="header_title_actions">
          <h3>Ledger Sub Entries</h3>
          <button className="create_btn" id="showFormBtn" onClick={openCreateSubEntry}>
            Add Sub Entry
          </button>
        </div>
      </div>

      {subModalOpen ? (
        <div id="subEntryModal" className="overlay" style={{ display: "flex" }}>
          <div className="form-container">
            <div className="ledger_modal_header">
              <h3 id="modalTitle">{editingSubId ? "Edit Sub Entry" : "Add Sub Entry"}</h3>
              <button
                type="button"
                className="ledger_modal_close"
                aria-label="Close modal"
                onClick={() => setSubModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="ledger_modal_divider" />
            <div className="content_padding">
              <form id="subEntryForm" onSubmit={submitSubEntry}>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" name="date" required value={subDate} onChange={(e) => setSubDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Particular</label>
                  <input
                    type="text"
                    name="particular"
                    required
                    value={particular}
                    onChange={(e) => setParticular(e.target.value)}
                  />
                </div>

                <div className="toggle_margin">
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="toggleType"
                      checked={isDr}
                      onChange={(e) => setIsDr(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                  <span className="toggle-label" id="toggleLabel">
                    {isDr ? "Dr (Paid)" : "Cr (Received)"}
                  </span>
                </div>

                {!isDr ? (
                  <div id="crField">
                    <input
                      type="number"
                      name="received"
                      placeholder="Received (Cr)"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                    />
                  </div>
                ) : null}

                {isDr ? (
                  <div id="drField">
                    <input
                      type="number"
                      name="paid"
                      placeholder="Paid (Dr)"
                      value={paid}
                      onChange={(e) => setPaid(e.target.value)}
                    />
                  </div>
                ) : null}

                <div className="form-group top">
                  <label>Remarks</label>
                  <input type="text" name="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>

                <div className="row">
                  <button type="submit" className="save_btn">
                    Save
                  </button>
                  <button
                    type="button"
                    className="cancel_btn"
                    id="cancelFormBtn"
                    onClick={() => setSubModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {editLedgerModalOpen ? (
        <div id="editLedgerModal" className="overlay" style={{ display: "flex" }}>
          <div className="form-container">
            <div className="ledger_modal_header">
              <h3>Edit Ledger</h3>
              <button
                type="button"
                className="ledger_modal_close"
                aria-label="Close modal"
                onClick={() => setEditLedgerModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="ledger_modal_divider" />
            <div className="content_padding">
              <form id="editLedgerForm" onSubmit={saveLedger}>
                <div className="form-group">
                  <label>Party Ledger</label>
                  <input
                    type="text"
                    name="partyLedger"
                    required
                    value={ledgerParty}
                    onChange={(e) => setLedgerParty(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    value={ledgerDate}
                    onChange={(e) => setLedgerDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    name="category"
                    value={ledgerCategory}
                    onChange={(e) => setLedgerCategory(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    id="editStatus"
                    name="status"
                    required
                    value={ledgerStatus}
                    onChange={(e) => setLedgerStatus(e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div className="row">
                  <button type="submit" className="save_btn">
                    Save
                  </button>
                  <button
                    type="button"
                    className="cancel_btn"
                    id="cancelLedgerBtn"
                    onClick={() => setEditLedgerModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <div id="ledgerCard" className="ledger-card">
        <div id="ledgerInfoContent">
          <strong>Party Ledger:</strong> {ledger?.partyLedger || "-"}
          <br />
          <strong>Date:</strong> {formatDate(ledger?.date) || "-"}
          <br />
          <strong>Category:</strong> {ledger?.category || "-"}
          <br />
          <strong>Status:</strong> {ledger?.status || "-"}
        </div>
        <div className="top">
          <button
            id="editLedgerBtn"
            className="editBtn"
            aria-label="Edit Ledger"
            title="Edit Ledger"
            onClick={() => setEditLedgerModalOpen(true)}
          >
            <i className="fas fa-pen" aria-hidden="true" />
          </button>
          <button
            id="deleteLedgerBtn"
            className="cancel_btn"
            aria-label="Delete Ledger"
            title="Delete Ledger"
            onClick={deleteLedger}
          >
            <i className="fas fa-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="table-container">
        <table id="subEntryTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particular</th>
              <th>Dr (Paid)</th>
              <th>Cr (Received)</th>
              <th>Balance</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithBalance.map(({ entry, cr, dr, runningBalance }) => (
              <tr key={entry._id}>
                <td>{formatDate(entry.date)}</td>
                <td>{entry.particular}</td>
                <td>{dr}</td>
                <td>{cr}</td>
                <td>{runningBalance}</td>
                <td>{entry.remarks}</td>
                <td className="row">
                  <button
                    className="editBtn"
                    aria-label="Edit sub entry"
                    title="Edit"
                    onClick={() => openEditSubEntry(entry)}
                  >
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button
                    className="deleteBtn"
                    aria-label="Delete sub entry"
                    title="Delete"
                    onClick={() => deleteSubEntry(entry._id)}
                  >
                    <i className="fas fa-trash" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
