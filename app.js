import { encodeFunctionData, parseUnits, isAddress } from "viem";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

const connectButton = document.getElementById("connectButton");
const sendButton = document.getElementById("sendButton");
const walletStatus = document.getElementById("walletStatus");
const disconnectButton = document.getElementById("disconnectButton");
const walletProfile = document.getElementById("walletProfile");
const walletAvatar = document.getElementById("walletAvatar");
const walletShortAddress = document.getElementById("walletShortAddress");
const recipientInput = document.getElementById("recipient");
const amountInput = document.getElementById("amount");
const message = document.getElementById("message");
const batchSendButton = document.getElementById("batchSendButton");
const batchPayments = document.getElementById("batchPayments");
const batchMessage = document.getElementById("batchMessage");
const csvFile = document.getElementById("csvFile");
const csvSummary = document.getElementById("csvSummary");
const csvPreview = document.getElementById("csvPreview");
const csvPreviewList = document.getElementById("csvPreviewList");
const csvRecipientCount = document.getElementById("csvRecipientCount");
const csvTotalAmount = document.getElementById("csvTotalAmount");

const BATCH_CONTRACT = "0xB15C4f77234f8e03AbB564834e3FbFc15aAe60d0";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";

const ARC_CHAIN_ID = "0x4cef52";

let walletProvider = null;
let walletAddress = null;
let adapter = null;

const kit = new AppKit();
function generateWalletAvatar(address) {
  const hash = address.slice(2).toLowerCase();
  let html = "<div style=\"display:grid;grid-template-columns:repeat(5,1fr);width:100%;height:100%;gap:2px;padding:5px;\">";
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const sourceCol = col > 2 ? 4 - col : col;
      const index = (row * 3 + sourceCol) % hash.length;
      const value = parseInt(hash[index], 16);
      const active = value % 2 === 0;
      html += "<span style=\"border-radius:2px;background:" + (active ? "#f5f7fa" : "transparent") + ";\"></span>";
    }
  }
  html += "</div>";
  walletAvatar.innerHTML = html;
}

function updateCsvPreview(rows) {
  csvPreviewList.innerHTML = "";
  let total = 0;

  rows.forEach(row => {
    const [address, amount] = row.split(",");
    total += Number(amount);

    const item = document.createElement("div");
    item.className = "csv-preview-row";

    const addressEl = document.createElement("span");
    addressEl.className = "csv-preview-address";
    addressEl.textContent = address.slice(0, 6) + "..." + address.slice(-4);

    const amountEl = document.createElement("span");
    amountEl.className = "csv-preview-amount";
    amountEl.textContent = amount + " USDC";

    item.append(addressEl, amountEl);
    csvPreviewList.appendChild(item);
  });

  csvRecipientCount.textContent = rows.length + " recipient" + (rows.length === 1 ? "" : "s");
  csvTotalAmount.textContent = total.toLocaleString(undefined, { maximumFractionDigits: 6 }) + " USDC";
  csvPreview.hidden = false;
}
connectButton.addEventListener("click", async () => {
  try {
    message.textContent = "Connecting wallet...";

    if (!window.ethereum) {
      throw new Error("No compatible wallet found.");
    }

    walletProvider = window.ethereum;

    await walletProvider.request({
      method: "eth_requestAccounts"
    });

    try {
      await walletProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID }]
      });
    } catch (error) {
      if (error.code === 4902) {
        await walletProvider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_CHAIN_ID,
            chainName: "Arc Testnet",
            nativeCurrency: {
              name: "USDC",
              symbol: "USDC",
              decimals: 18
            },
            rpcUrls: ["https://rpc.testnet.arc.io"],
            blockExplorerUrls: ["https://testnet.arcscan.app"]
          }]
        });
      } else {
        throw error;
      }
    }

    const accounts = await walletProvider.request({
      method: "eth_accounts"
    });

    walletAddress = accounts[0];
    clearLoadedSavedLists();

    adapter = await createViemAdapterFromProvider({
      provider: walletProvider
    });

    walletStatus.textContent =
      "Connected: " +
      walletAddress.slice(0, 6) +
      "..." +
      walletAddress.slice(-4);

    connectButton.textContent = "Wallet Connected";
    connectButton.hidden = true;
    disconnectButton.hidden = false;
    walletShortAddress.textContent = walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
    generateWalletAvatar(walletAddress);
    walletProfile.hidden = false;
    sendButton.disabled = false;
    batchSendButton.disabled = false;
    renderSavedLists();
    message.textContent = "Ready to send USDC on Arc Testnet.";
  } catch (error) {
    console.error(error);
    message.textContent =
      error?.message || "Wallet connection failed.";
  }
});

sendButton.addEventListener("click", async () => {
  if (!adapter || !walletAddress) {
    message.textContent = "Connect your wallet first.";
    return;
  }

  const recipient = recipientInput.value.trim();
  const amount = amountInput.value.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    message.textContent = "Enter a valid recipient address.";
    return;
  }

  if (!amount || Number(amount) <= 0) {
    message.textContent = "Enter a valid USDC amount.";
    return;
  }

  sendButton.disabled = true;
  message.textContent = "Preparing transaction...";

  try {
    const params = {
      from: {
        adapter,
        chain: "Arc_Testnet",
        address: walletAddress
      },
      to: recipient,
      amount,
      token: "USDC"
    };

    await kit.estimateSend(params);

    message.textContent =
      "Confirm the payment in your wallet...";

    const result = await kit.send(params);

    console.log("Payment result:", result);

    if (result?.txHash) {
      message.innerHTML =
        'Payment submitted. <a href="https://testnet.arcscan.app/tx/' +
        result.txHash +
        '" target="_blank" rel="noopener noreferrer">View transaction</a>';
    } else {
      message.textContent =
        "Payment submitted successfully.";
    }
  } catch (error) {
    console.error(error);
    message.textContent =
      error?.message || "Payment failed or was rejected.";
  } finally {
    sendButton.disabled = false;
    batchSendButton.disabled = false;
  }
});


batchSendButton.addEventListener("click", async () => {
  try {
    if (!walletProvider || !walletAddress) {
      throw new Error("Connect your wallet first.");
    }

    const lines = batchPayments.value
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("Enter at least one recipient.");
    }

    const recipients = [];
    const amounts = [];
    let total = 0n;

    for (const line of lines) {
      const parts = line.replace(/^"|"$/g, "").split(",");

      if (parts.length !== 2) {
        throw new Error("Use: wallet-address,amount");
      }

      const recipient = parts[0].trim();
      const amountText = parts[1].trim();

      if (!isAddress(recipient)) {
        throw new Error(`Invalid address: ${recipient}`);
      }

      const amount = parseUnits(amountText, 6);

      if (amount <= 0n) {
        throw new Error("Amounts must be greater than zero.");
      }

      recipients.push(recipient);
      amounts.push(amount);
      total += amount;
    }

    batchMessage.textContent =
      `Preparing ${recipients.length} payment(s)...`;

    const allowanceData = encodeFunctionData({
      abi: [{
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" }
        ],
        outputs: [{ type: "uint256" }]
      }],
      functionName: "allowance",
      args: [walletAddress, BATCH_CONTRACT]
    });

    const allowanceResult = await walletProvider.request({
      method: "eth_call",
      params: [{
        to: USDC_CONTRACT,
        data: allowanceData
      }, "latest"]
    });

    const allowance = BigInt(allowanceResult);

    if (allowance < total) {
      batchMessage.textContent =
        "USDC approval required. Confirm it in your wallet...";

      const approveData = encodeFunctionData({
        abi: [{
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: [{ type: "bool" }]
        }],
        functionName: "approve",
        args: [BATCH_CONTRACT, total]
      });

      const approvalTx = await walletProvider.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: USDC_CONTRACT,
          data: approveData
        }]
      });

      batchMessage.textContent =
        "Approval submitted. Waiting for confirmation...";

      let receipt = null;

      while (!receipt) {
        receipt = await walletProvider.request({
          method: "eth_getTransactionReceipt",
          params: [approvalTx]
        });

        if (!receipt) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (receipt.status !== "0x1") {
        throw new Error("USDC approval failed.");
      }
    }

    const batchData = encodeFunctionData({
      abi: [{
        type: "function",
        name: "batchTransfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "recipients", type: "address[]" },
          { name: "amounts", type: "uint256[]" }
        ],
        outputs: []
      }],
      functionName: "batchTransfer",
      args: [recipients, amounts]
    });

    batchMessage.textContent =
      "Confirm the batch transaction in your wallet...";

    const gasEstimate = await walletProvider.request({
      method: "eth_estimateGas",
      params: [{
        from: walletAddress,
        to: BATCH_CONTRACT,
        data: batchData
      }]
    });
    const txHash = await walletProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from: walletAddress, gas: gasEstimate,
        to: BATCH_CONTRACT,
        data: batchData
      }]
    });

    batchMessage.innerHTML =
      'Batch payment submitted. <a href="https://testnet.arcscan.app/tx/' +
      txHash +
      '" target="_blank" rel="noopener noreferrer">View transaction</a>';

    batchPayments.value = "";

    console.log("Batch transaction:", txHash);

  } catch (error) {
    console.error(error);

    batchMessage.textContent =
      error?.shortMessage ||
      error?.message ||
      "Batch payment failed or was rejected.";
  }
});

csvFile.addEventListener("change", async () => {
  try {
    const file = csvFile.files[0];

    if (!file) return;

    const text = await file.text();

    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("CSV file is empty.");
    }

    let start = 0;

    if (lines[0].toLowerCase() === "recipient,amount") {
      start = 1;
    }

    const rows = lines.slice(start);

    if (rows.length === 0) {
      throw new Error("CSV contains no recipients.");
    }

    if (rows.length > 100) {
      throw new Error("Maximum 100 recipients allowed.");
    }

    const validRows = [];

    for (const line of rows) {
      const parts = line.replace(/^"|"$/g, "").split(",");

      if (parts.length !== 2) {
        throw new Error(`Invalid CSV row: ${line}`);
      }

      const address = parts[0].trim();
      const amount = parts[1].trim();

      if (!isAddress(address)) {
        throw new Error(`Invalid wallet address: ${address}`);
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
      }

      validRows.push(`${address},${amount}`);
    }

    batchPayments.value = validRows.join("\n");
    updateCsvPreview(validRows);

    csvSummary.textContent =
      `${validRows.length} recipient(s) loaded successfully.`;

    batchMessage.textContent =
      "CSV loaded. Review the batch and press Send Batch.";

  } catch (error) {
    csvSummary.textContent = "";
    csvPreview.hidden = true;
    csvPreviewList.innerHTML = "";
    csvRecipientCount.textContent = "";
    csvTotalAmount.textContent = "0 USDC";
    batchPayments.value = "";
    batchMessage.textContent =
      error?.message || "Failed to read CSV.";
    csvFile.value = "";
  }
});

disconnectButton.addEventListener("click", () => {
  walletProvider = null;
  walletAddress = null;
  adapter = null;

  walletStatus.textContent = "Wallet not connected";
  connectButton.textContent = "Connect Wallet";
  connectButton.hidden = false;
  disconnectButton.hidden = true;
  walletProfile.hidden = true;

  sendButton.disabled = true;
  batchSendButton.disabled = true;
  renderSavedLists();

  message.textContent = "Wallet disconnected.";
});

const savedListsButton = document.getElementById("savedListsButton");
const savedListsPanel = document.getElementById("savedListsPanel");
const closeSavedLists = document.getElementById("closeSavedLists");

savedListsButton.addEventListener("click", () => {
  savedListsPanel.hidden = false;
  savedListsButton.hidden = true;
});

closeSavedLists.addEventListener("click", () => {
  savedListsPanel.hidden = true;
  savedListsButton.hidden = false;
});


function getSavedListsKey() {
  if (!walletAddress) return null;
  return "arcPay_saved_lists_" + walletAddress.toLowerCase();
}

function getSavedLists() {
  const key = getSavedListsKey();
  if (!key) return [];

  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveSavedLists(lists) {
  const key = getSavedListsKey();
  if (!key) return;

  localStorage.setItem(key, JSON.stringify(lists));
}

function clearLoadedSavedLists() {
  const lists = getSavedLists();
  if (!lists.length) return;

  let changed = false;

  lists.forEach(list => {
    if (list.loaded) {
      list.loaded = false;
      changed = true;
    }
  });

  if (changed) {
    saveSavedLists(lists);
  }
}

function renderSavedLists() {
  const content = document.getElementById("savedListsContent");

  if (!walletAddress) {
    content.innerHTML = "<p>Connect wallet to view saved lists.</p>";
    return;
  }

  const lists = getSavedLists();

  if (lists.length === 0) {
    content.innerHTML = "<p>No saved lists.</p>";
    return;
  }

  content.innerHTML = "";

  lists.forEach((list, index) => {
    const item = document.createElement("div");
    item.className = "saved-list-item";

    if (list.loaded) {
      item.classList.add("saved-list-loaded");
    }

    const info = document.createElement("div");
    info.className = "saved-list-info";

    const name = document.createElement("strong");
    name.textContent = list.name;

    const count = document.createElement("span");
    count.textContent =
      list.rows.length +
      " recipient" +
      (list.rows.length === 1 ? "" : "s");

    info.append(name, count);
    item.appendChild(info);

    if (!list.loaded) {
      const loadButton = document.createElement("button");
      loadButton.className = "saved-list-load";
      loadButton.textContent = "🔁";
      loadButton.setAttribute("aria-label", "Load " + list.name);

      loadButton.addEventListener("click", event => {
        event.stopPropagation();

        const updatedLists = getSavedLists();

        updatedLists.forEach(saved => {
          saved.loaded = false;
        });

        const selected = updatedLists[index];
        selected.loaded = true;

        updatedLists.splice(index, 1);
        updatedLists.unshift(selected);

        saveSavedLists(updatedLists);

        batchPayments.value = selected.rows.join("\n");
        updateCsvPreview(selected.rows);
        batchPayments.hidden = true;
        batchMessage.textContent = selected.name + " loaded.";

        renderSavedLists();
      });

      item.appendChild(loadButton);
    }

    let pressTimer = null;
    let longPressTriggered = false;

    item.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;

      longPressTriggered = false;

      pressTimer = setTimeout(() => {
        const currentLists = getSavedLists();
        const currentIndex = currentLists.findIndex(
          saved => saved.name === list.name
        );

        if (currentIndex === -1) return;

        longPressTriggered = true;
        openSavedListActionMenu(list);
      }, 700);
    });

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    item.addEventListener("pointerup", cancelPress);
    item.addEventListener("pointercancel", cancelPress);

    content.appendChild(item);
  });
}

renderSavedLists();


const savedCsvFile = document.getElementById("savedCsvFile");

const savedCsvNameOverlay =
  document.getElementById("savedCsvNameOverlay");

const savedCsvNameInput =
  document.getElementById("savedCsvNameInput");

const cancelSavedCsvName =
  document.getElementById("cancelSavedCsvName");

const confirmSavedCsvName =
  document.getElementById("confirmSavedCsvName");

let pendingCsvRows = null;
let pendingCsvFileName = "";

savedCsvFile.addEventListener("change", async () => {
  try {
    const file = savedCsvFile.files[0];

    if (!file) return;

    if (!walletAddress) {
      throw new Error("Connect wallet before saving a CSV.");
    }

    const text = await file.text();

    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("CSV file is empty.");
    }

    let start = 0;

    if (lines[0].toLowerCase() === "recipient,amount") {
      start = 1;
    }

    const rows = lines.slice(start);

    if (rows.length === 0) {
      throw new Error("CSV contains no recipients.");
    }

    if (rows.length > 100) {
      throw new Error("Maximum 100 recipients allowed.");
    }

    const validRows = [];

    for (const line of rows) {
      const parts = line.replace(/^"|"$/g, "").split(",");

      if (parts.length !== 2) {
        throw new Error(`Invalid CSV row: ${line}`);
      }

      const address = parts[0].trim();
      const amount = parts[1].trim();

      if (!isAddress(address)) {
        throw new Error(`Invalid wallet address: ${address}`);
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
      }

      validRows.push(`${address},${amount}`);
    }

    pendingCsvRows = validRows;
    pendingCsvFileName = file.name;

    savedCsvNameInput.value =
      file.name.replace(/\.csv$/i, "");

    savedCsvNameOverlay.hidden = false;

    setTimeout(() => {
      savedCsvNameInput.focus();
      savedCsvNameInput.select();
    }, 50);

  } catch (error) {
    batchMessage.textContent =
      error?.message || "Failed to read CSV.";

    savedCsvFile.value = "";
    pendingCsvRows = null;
  }
});

function closeSavedCsvNameDialog() {
  savedCsvNameOverlay.hidden = true;
  savedCsvFile.value = "";
  pendingCsvRows = null;
  pendingCsvFileName = "";
}

cancelSavedCsvName.addEventListener(
  "click",
  closeSavedCsvNameDialog
);

confirmSavedCsvName.addEventListener("click", () => {
  try {
    if (!walletAddress) {
      throw new Error("Connect wallet before saving a CSV.");
    }

    if (!pendingCsvRows) {
      throw new Error("Choose a CSV file first.");
    }

    const name = savedCsvNameInput.value.trim();

    if (!name) {
      throw new Error("Enter a name for this saved list.");
    }

    const lists = getSavedLists();

    if (
      lists.some(
        list => list.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      throw new Error("A saved list with that name already exists.");
    }

    lists.push({
      name,
      fileName: pendingCsvFileName,
      rows: pendingCsvRows,
      loaded: false
    });

    saveSavedLists(lists);
    renderSavedLists();

    batchMessage.textContent =
      `${name} saved to this wallet.`;

    closeSavedCsvNameDialog();

  } catch (error) {
    batchMessage.textContent =
      error?.message || "Failed to save CSV.";
  }
});

savedCsvNameOverlay.addEventListener("click", event => {
  if (event.target === savedCsvNameOverlay) {
    closeSavedCsvNameDialog();
  }
});

