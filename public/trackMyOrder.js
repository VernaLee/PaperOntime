import {
  getOrderByEmailAndNumber,
  updateOrderDetails
} from 'backend/afterPaymentService.web.js';
import wixData from 'wix-data';
import wixWindow from 'wix-window';

let currentOrder = null;
let tempDocuments = [];  // clone of order.documents for UI only
let isEditMode   = false;

$w.onReady(() => {
  // ── INITIAL STATE ──────────────────────────────────────────────────────────
  $w("#sectionTwo").collapse();
  $w("#orderError").hide();
  $w("#uploading").collapse();    // hide upload-status indicator
  $w("#saveButtonTop").collapse();
  $w("#fileRepeater").collapse();
  disableControls();

  // ── SEARCH HELPER ─────────────────────────────────────────────────────────
  $w("#searchHelperInput").hide();
  $w("#searchHelperInput").onKeyPress((event) => {
    const char = event.key.toUpperCase();
    const match = $w('#paperTypeDropdown').options.find(opt =>
      opt.label.trim().toUpperCase().startsWith(char)
    );
    if (match) {
      $w("#paperTypeDropdown").value = match.value;
    }
  });

  showViewMode();

  // ── TRACK BUTTON ───────────────────────────────────────────────────────────
  $w("#trackButton").onClick(async () => {
    $w("#orderError").hide();
    const email       = $w("#emailInput").value.trim();
    const orderNumber = $w("#orderNumberInput").value.trim();

    if (!email || !orderNumber) {
      $w("#orderError").text = "Please enter both email and order number.";
      return $w("#orderError").show();
    }

    try {
      const order = await getOrderByEmailAndNumber(email, orderNumber);
      if (!order) {
        $w("#orderError").text = "Order not found.";
        return $w("#orderError").show();
      }

      currentOrder = order;
      disableControls();
      populateForm(order);
      populateFileNames(order);

      $w("#saveButtonTop").collapse();
      showViewMode();
      updateProductionState();
      await $w("#sectionTwo").expand();
      $w("#orderDetailError").hide();
      $w("#sectionTwo").scrollTo();
    } catch (err) {
      console.error(err);
      $w("#orderError").text = "Something went wrong. Please try again later.";
      $w("#orderError").show();
    }
  });

  // ── EDIT BUTTON ────────────────────────────────────────────────────────────
  $w("#editButtonTop").onClick(() => {
    if (!currentOrder) return;
    enableControls();
    $w("#saveButtonTop").expand().then(() => $w("#saveButtonTop").show("fade"));
    showEditMode();
  });

  // ── SAVE BUTTON ────────────────────────────────────────────────────────────
  $w("#saveButtonTop").onClick(async () => {
    if (!currentOrder) return;
    $w("#orderDetailError").hide();

    // 1) Validate required fields
    const required = [
      "#paperTypeDropdown",
      "#subjectAreaDropdown",
      "#subjectDropdown",
      "#essayTopicInput",
      "#essayInstructionsInput",
      "#referencingStyleDropdown",
      "#sourcesInput",
      "#orderEmailInput"
    ];
    if (required.some(sel => {
      const v = $w(sel).value;
      return !v || !v.toString().trim();
    })) {
      $w("#orderDetailError").text = "Please fill in all fields before saving.";
      $w("#orderDetailError").show();
      return
    }

    // 2) Disable Save button
    $w("#saveButtonTop").label = "Saving…";
    $w("#saveButtonTop").disable();

    // 3) Upload files (only show uploadingText here)
    let docs = [...tempDocuments];
    
    const uploader = $w("#fileSelectionButton");

    if (uploader.value?.length) {
      $w("#uploading").expand();
      try {
        const results = await uploader.uploadFiles();
        results.forEach(r => docs.push({
          filename: r.originalFileName,
          fileUrl:  r.fileUrl
        }));
      } catch (uploadErr) {
        console.error("File upload failed:", uploadErr);

        // 1) reset the file picker
        uploader.reset();

        // 2) collapse your strip
        $w("#uploading").collapse();

        // 3) restore Save button
        $w("#saveButtonTop").label = "Save";
        $w("#saveButtonTop").enable();

        // 4) show error
        $w("#orderDetailError")
          .text = "File upload failed. Please try again.";
        $w("#orderDetailError").show();
        return;
      } finally {
        // always hide strip when done
        $w("#uploading").collapse();
      }
    }

    // 4) Save back to collection
    const fields = {
      service:          $w("#serviceDropdown").value,
      academicLevel:    $w("#academicLevelDropdown").value,
      deadline:         $w("#deadlineDropdown").value,
      wordCount:        $w("#wordCountInput").value,
      paperType:        $w("#paperTypeDropdown").value,
      subjectArea:      $w("#subjectAreaDropdown").value,
      subject:          $w("#subjectDropdown").value,
      essayTopic:       $w("#essayTopicInput").value,
      instructions:     $w("#essayInstructionsInput").value,
      referencingStyle: $w("#referencingStyleDropdown").value,
      sources:          $w("#sourcesInput").value,
      email:            $w("#orderEmailInput").value,
      documents:        docs
    };

    try {
      currentOrder = await updateOrderDetails({
        email:       currentOrder.email,
        orderNumber: currentOrder.orderNumber,
        fields
      });
    } catch (saveErr) {
      console.error("Save failed:", saveErr);
      $w("#orderDetailError").text = "Save failed. Please try again.";
      $w("#orderDetailError").show();
      return
    }

    // 5) Refresh UI & reset
    populateForm(currentOrder);
    populateFileNames(currentOrder);
    disableControls();
    showViewMode();

    // Restore Save button
    $w("#saveButtonTop").label = "Save";
    $w("#saveButtonTop").enable();
  });

  $w("#cancelButton").onClick(async () => {
  if (!currentOrder) return;

  const result = await wixWindow.openLightbox("CancelConfirmLightbox");

  if (result === "confirm") {
    // User confirmed discarding changes
    populateForm(currentOrder);    // Reset fields to last saved state
    populateFileNames(currentOrder); 
    disableControls();
    showViewMode();
  }
});
});

function loadSubjects(area, selectedSubject) {
  // clear old options & disable
  $w("#subjectDropdown").options = [];
  $w("#subjectDropdown").disable();

  return wixData
    .query("Subjects")
    .eq("title", area)
    .distinct("subject")
    .then((res) => {
      // support both array or { items: [] }
      let subjects = Array.isArray(res) ? res : (res.items || []);
      // build { label, value } list
      const opts = subjects.map(s => ({ label: s, value: s }));
      $w("#subjectDropdown").options = opts;

      // if we have a subject to pre‑select, do it
      if (selectedSubject && subjects.includes(selectedSubject)) {
        $w("#subjectDropdown").value = selectedSubject;
      }

      // re‑enable and clear any “required” styling
      $w("#subjectDropdown").enable();
      $w("#subjectDropdown").resetValidityIndication();
    })
    .catch((err) => {
      console.error("Error loading subjects:", err);
    });
}

$w("#subjectAreaDropdown").onChange(async () => {
  const selectedArea = $w("#subjectAreaDropdown").value;

  if (!selectedArea) {
    // No area selected, clear subjects
    $w("#subjectDropdown").options = [];
    $w("#subjectDropdown").disable();
    return;
  }

  // Load the subjects for the selected area
  await loadSubjects(selectedArea);
});

function populateForm(order) {
  $w("#orderStatusText").text          = order.status;
  $w("#serviceDropdown").value          = order.service;
  $w("#academicLevelDropdown").value    = order.academicLevel;
  $w("#deadlineDropdown").value         = order.deadline;
  $w("#wordCountInput").value           = order.wordCount;
  $w("#paperTypeDropdown").value        = order.paperType;
  $w("#subjectAreaDropdown").value      = order.subjectArea;
  $w("#subjectDropdown").value          = order.subject;
  $w("#essayTopicInput").value          = order.essayTopic;
  $w("#essayInstructionsInput").value   = order.instructions;
  $w("#referencingStyleDropdown").value = order.referencingStyle;
  $w("#sourcesInput").value             = order.sources;
  $w("#orderEmailInput").value          = order.email;
}

// ── helper to (re)render the repeater ─────────────────────────────────────
function refreshFileRepeater() {
  if (tempDocuments.length === 0) {
    $w("#fileRepeater").collapse();
    $w("#fileNameText").expand();
    return;
  }

  $w("#fileNameText").collapse();
  $w("#fileRepeater").expand();

  // Reset repeater data
  $w("#fileRepeater").data = tempDocuments.map((file, i) => ({
    _id: String(i),
    filename: file.filename,
    fileUrl: file.fileUrl
  }));

  // Rebind after setting data
  $w("#fileRepeater").onItemReady(($item, itemData) => {
    $item("#fileButton").label = itemData.filename;

    let realUrl = itemData.fileUrl;
    if (realUrl.startsWith("wix:document://v1/")) {
      const m = realUrl.match(/^wix:document:\/\/v1\/([^/]+)/);
      if (m) realUrl = `https://www.paperontime.online/_files/ugd/${m[1]}`;
    }
    $item("#fileButton").link = realUrl;
    $item("#fileButton").target = "_blank";

    // Show or hide delete button
    if (isEditMode) {
      $item("#deleteButton").show();
    } else {
      $item("#deleteButton").hide();
    }

    // ✅ Delete using fileUrl matching, not index
    $item("#deleteButton").onClick(() => {
      tempDocuments = tempDocuments.filter(doc => doc.fileUrl !== itemData.fileUrl);
      refreshFileRepeater();
    });
  });
}

// ── called whenever you load a new order ──────────────────────────────────
function populateFileNames(order) {
  tempDocuments = [...(order.documents || [])];
  refreshFileRepeater();
}

function disableControls() {
  [
    "#serviceDropdown",
    "#academicLevelDropdown",
    "#deadlineDropdown",
    "#wordCountInput",
    "#paperTypeDropdown",
    "#subjectAreaDropdown",
    "#subjectDropdown",
    "#essayTopicInput",
    "#essayInstructionsInput",
    "#referencingStyleDropdown",
    "#sourcesInput",
    "#orderEmailInput"
  ].forEach(id => $w(id).disable());
}

function enableControls() {
  [
    "#paperTypeDropdown",
    "#subjectAreaDropdown",
    "#subjectDropdown",
    "#essayTopicInput",
    "#essayInstructionsInput",
    "#referencingStyleDropdown",
    "#sourcesInput",
    "#orderEmailInput"
  ].forEach(id => $w(id).enable());
}

function showViewMode() {
  isEditMode = false;
  refreshFileRepeater();
  $w("#fileNameText").show();
  $w("#fileText").show();
  $w("#fileSelectionButton").hide();
  $w("#uploadText").hide();
  $w("#uploading").collapse();

  $w("#editButtonTop").show();
  updateProductionState();
  $w("#saveButtonTop").hide();
  $w("#cancelButton").hide();

  // 🔵 Disable delete buttons inside repeater
  $w("#fileRepeater").forEachItem(($item, itemData, index) => {
    $item("#deleteButton").hide();
  });
}

function showEditMode() {
  isEditMode = true;
  refreshFileRepeater();
  $w("#fileText").hide();
  $w("#fileSelectionButton").show();
  $w("#uploadText").show();
  $w("#saveButtonTop").show();
  $w("#uploading").collapse();

  $w("#editButtonTop").hide();
  $w("#saveButtonTop").show();
  $w("#cancelButton").show();

  // 🔵 Enable delete buttons inside repeater
  $w("#fileRepeater").forEachItem(($item, itemData, index) => {
    $item("#deleteButton").show();
  });
}


function updateProductionState() {
  if (!currentOrder) return;

  // 1) Parse your paidAt timestamp (make sure it's present on the record)
  const paidAtMs = currentOrder.paidAt
    ? new Date(currentOrder.paidAt).getTime()
    : 0;

  // 2) Check for “successful + >3 hours old”
  const threeHoursMs = 3 * 60 * 60 * 1000;
  const inProduction = 
    currentOrder.status === "Successful" &&
    (Date.now() - paidAtMs) > threeHoursMs;

  // 3) Toggle the Edit button
  if (inProduction) {
    $w("#editButtonTop").disable();
    $w("#orderStatusText")
      .text = "In production - No changes can be made.";
  } else {
    $w("#editButtonTop").enable();
  }
}
