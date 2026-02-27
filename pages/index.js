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

function capitalizeFirstLetter(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function HomePage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editId, setEditId] = useState("");
  const [partyLedger, setPartyLedger] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const modalTitle = useMemo(
    () => (editId ? "Edit Ledger Entry" : "Create Ledger Entry"),
    [editId]
  );

  async function calculateBalance(id) {
    try {
      const res = await fetch(`/sub-entries/${id}`);
      if (!res.ok) return 0;
      const entries = await res.json();

      let totalReceived = 0;
      let totalPaid = 0;
      for (const entry of entries) {
        totalReceived += Number(entry.received || 0);
        totalPaid += Number(entry.paid || 0);
      }
      return totalReceived - totalPaid;
    } catch {
      return 0;
    }
  }

  async function loadRequests() {
    const res = await fetch("/requests");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setRequests(data);

    const balanceEntries = await Promise.all(
      data.map(async (req) => [req._id, await calculateBalance(req._id)])
    );
    setBalances(Object.fromEntries(balanceEntries));
  }

  useEffect(() => {
    loadRequests();
  }, []);

  function openCreateModal() {
    const today = new Date().toISOString().split("T")[0];
    setEditId("");
    setPartyLedger("");
    setDate(today);
    setCategory("");
    setStatus("");
    setModalOpen(true);
  }

  function openEditModal(req) {
    setEditId(req._id);
    setPartyLedger(req.partyLedger || "");
    setDate((req.date || "").split("T")[0]);
    setCategory(req.category || "");
    setStatus(req.status || "");
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    const payload = { partyLedger, date, category, status };
    const endpoint = editId ? `/request/${editId}` : "/submit";
    const method = editId ? "PUT" : "POST";

    await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    setModalOpen(false);
    await loadRequests();
  }

  return (
    <>
      <Head>
        <title>Ledger Entries</title>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </Head>

      <div className="text_btn_alignment">
        <div className="header_title_actions">
          <h3>Ledger Entries</h3>
          <button id="showFormBtn" className="create_btn" onClick={openCreateModal}>
            Create Ledger
          </button>
        </div>
        <div className="header_actions">
          <button
            type="button"
            className="logout_btn"
            onClick={() => router.push("/logout")}
          >
            Logout
          </button>
        </div>
      </div>

      {modalOpen ? (
        <div id="ledgerModal" className="overlay" style={{ display: "flex" }}>
          <div className="modal_background">
            <div className="ledger_modal_header">
              <h3 id="modalTitle">{modalTitle}</h3>
              <button
                type="button"
                className="ledger_modal_close"
                aria-label="Close modal"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="ledger_modal_divider" />
            <div className="content_padding">
              <form id="modalLedgerForm" onSubmit={onSubmit}>
                <div className="form-group">
                  <label>Party Ledger Name</label>
                  <input
                    type="text"
                    id="editLedgerName"
                    name="partyLedger"
                    required
                    value={partyLedger}
                    onChange={(e) =>
                      setPartyLedger(capitalizeFirstLetter(e.target.value))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    id="editLedgerDate"
                    name="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    id="editCategory"
                    name="category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    id="editStatus"
                    name="status"
                    required
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Done">Done</option>
                  </select>
                </div>

                <div className="row">
                  <button type="submit" className="save_btn" disabled={submitting}>
                    {submitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="cancel_btn"
                    id="cancelFormBtn"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <div className="table-container">
        <table id="requestTable">
          <thead>
            <tr>
              <th>Party Ledger Name</th>
              <th>Date</th>
              <th>Category</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req._id} data-id={req._id}>
                <td>
                  <button
                    className="partyLedgerLink"
                    data-id={req._id}
                    style={{
                      color: "#007bff",
                      cursor: "pointer",
                      textDecoration: "underline",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                    }}
                    onClick={() => router.push(`/details?id=${req._id}`)}
                  >
                    {req.partyLedger}
                  </button>
                </td>
                <td>{formatDate(req.date)}</td>
                <td>{req.category}</td>
                <td>{req.status}</td>
                <td>{Number(balances[req._id] || 0).toFixed(2)}</td>
                <td>
                  <button
                    className="editBtn"
                    aria-label="Edit ledger row"
                    title="Edit"
                    onClick={() => openEditModal(req)}
                  >
                    <i className="fas fa-pen" aria-hidden="true" />
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
