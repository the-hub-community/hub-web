(function initSubmissionHistory() {
  "use strict";

  var storageKey = "resiHubSubmissions";
  var legacyStorageKeys = ["resihub_submissions"];

  function normalizeRecord(value) {
    if (typeof value === "string") {
      return { id: value.trim(), type: "submission" };
    }

    if (!value || typeof value !== "object") return null;
    var id = String(
      value.id || value.submissionId || value.submission_id || value.page_key || "",
    ).trim();
    if (!id) return null;

    var type = String(value.type || "submission").trim().toLowerCase();
    if (type === "listing") type = "marketplace";
    return {
      id: id,
      type: type,
      title: String(value.title || "").trim(),
      managementToken: String(value.managementToken || "").trim(),
      savedAt: String(value.savedAt || ""),
    };
  }

  function readAll() {
    var raw = localStorage.getItem(storageKey);
    if (raw === null) {
      for (var i = 0; i < legacyStorageKeys.length; i += 1) {
        raw = localStorage.getItem(legacyStorageKeys[i]);
        if (raw !== null) break;
      }
    }

    if (raw === null) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Saved submissions data is not a list.");
    }

    var records = [];
    var byId = new Map();
    parsed.forEach(function (item) {
      var record = normalizeRecord(item);
      if (!record) return;
      var existingIndex = byId.get(record.id);
      if (existingIndex === undefined) {
        byId.set(record.id, records.length);
        records.push(record);
      } else {
        records[existingIndex] = Object.assign(
          {},
          records[existingIndex],
          record,
        );
      }
    });
    return records;
  }

  function save(record) {
    var normalized = normalizeRecord(record);
    if (!normalized) throw new Error("Submission ID is required.");
    var records = readAll();
    var index = records.findIndex(function (item) {
      return item.id === normalized.id;
    });

    normalized.savedAt =
      normalized.savedAt || new Date().toISOString();
    if (index >= 0) {
      var existing = records[index];
      normalized = Object.assign({}, existing, normalized, {
        type:
          normalized.type === "submission" ? existing.type : normalized.type,
        title: normalized.title || existing.title,
        managementToken: normalized.managementToken || existing.managementToken,
      });
      records.splice(index, 1);
    }
    records.unshift(normalized);
    localStorage.setItem(storageKey, JSON.stringify(records));
    legacyStorageKeys.forEach(function (key) {
      localStorage.removeItem(key);
    });
    return normalized;
  }

  function find(submissionId) {
    var id = String(submissionId || "").trim();
    return (
      readAll().find(function (record) {
        return record.id === id;
      }) || null
    );
  }

  window.ResiHubSubmissionHistory = Object.freeze({
    getAll: readAll,
    save: save,
    find: find,
  });
})();
