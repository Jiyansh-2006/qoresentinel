import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  adminDashboardRouter,
  dashboardRouter,
  studentDashboardRouter,
} from "../routes/dashboardRoutes.js";
import { db } from "../database/db.js";

test("dashboard stats exclude simulated payouts and validate native balance requests", async () => {
  const app = express();
  app.use((req, _res, next) => {
    const role = req.header("x-test-role");
    if (role === "ADMIN" || role === "STUDENT") {
      req.authUser = {
        id: role === "STUDENT" ? "test_student_id" : "test_admin_id",
        email: role === "STUDENT" ? "student@example.test" : "admin@example.test",
        fullName: "Dashboard Test",
        role,
        profile: {},
        createdAt: new Date().toISOString(),
      };
    }
    next();
  });
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/admin/dashboard", adminDashboardRouter);
  app.use("/api/student/dashboard", studentDashboardRouter);
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/dashboard`;
  const nativeTransferId = "test_native_dashboard_transfer";
  const pendingGrantId = "test_pending_grant_transfer";
  const confirmedGrantId = "test_confirmed_grant_transfer";
  const confirmedPoolFundingId = "test_confirmed_pool_funding";
  const studentApplicationId = "test_student_dashboard_application";
  const secondStudentApplicationId = "test_second_student_application";
  const secondStudentGrantId = "test_second_student_grant";
  const studentApplication = {
    id: studentApplicationId,
    poolId: "test_pool",
    applicantEmail: "student@example.test",
    requestedAmountQOR: 125,
    approvedAmountBaseUnits: "0",
    status: "PENDING",
  };
  const secondStudentApplication = {
    id: secondStudentApplicationId,
    poolId: "test_pool",
    applicantEmail: "another.student@example.test",
    requestedAmountQOR: 500,
    approvedAmountBaseUnits: "500000000000000000000",
    status: "PAID",
  };
  db.applications.push(studentApplication, secondStudentApplication);
  db.transactions.unshift({
    id: nativeTransferId,
    applicationId: "wallet_transfer",
    txHash: "native-test-hash",
    blockNumber: 1,
    fromAddress: "qor1sender",
    toAddress: "qor1recipient",
    amount: "2000000",
    amountDecimals: 6,
    amountDenom: "uqor",
    network: "QoreChain Diana Testnet",
    transactionType: "WALLET_TRANSFER",
    isSimulated: false,
    status: "REPORTED",
    gasUsed: "0",
    explorerUrl: "https://explore.qore.network/tx/native-test-hash",
    createdAt: new Date().toISOString(),
  });
  db.transactions.unshift({
    id: confirmedGrantId,
    paymentIntentId: "test_confirmed_intent",
    applicationId: "test_application",
    poolId: "test_pool",
    ownerEmail: "admin@example.test",
    transactionType: "GRANT_PAYMENT",
    txHash: "0xconfirmed-grant-hash",
    blockNumber: 2,
    fromAddress: "0x0000000000000000000000000000000000000001",
    toAddress: "0x0000000000000000000000000000000000000002",
    amount: "2000000000000000000",
    amountDecimals: 18,
    amountDenom: "QOR",
    network: "QoreChain Diana Testnet",
    chainId: 9800,
    milestoneIndex: 0,
    isSimulated: false,
    status: "CONFIRMED",
    gasUsed: "0",
    explorerUrl: "https://explore.qore.network/tx/0xconfirmed-grant-hash",
    createdAt: new Date().toISOString(),
  });
  db.transactions.unshift({
    id: confirmedPoolFundingId,
    paymentIntentId: "test_confirmed_pool_intent",
    applicationId: "pool_funding",
    poolId: "test_pool",
    transactionType: "POOL_FUNDING",
    txHash: "0xconfirmed-pool-funding-hash",
    blockNumber: 3,
    fromAddress: "0x0000000000000000000000000000000000000001",
    toAddress: "0x0000000000000000000000000000000000000003",
    amount: "10000000000000000000",
    amountDecimals: 18,
    amountDenom: "QOR",
    network: "QoreChain Diana Testnet",
    chainId: 9800,
    isSimulated: false,
    status: "CONFIRMED",
    gasUsed: "0",
    explorerUrl: "https://explore.qore.network/tx/0xconfirmed-pool-funding-hash",
    createdAt: new Date().toISOString(),
  });
  db.transactions.unshift({
    id: secondStudentGrantId,
    paymentIntentId: "test_second_student_intent",
    applicationId: secondStudentApplicationId,
    poolId: "test_pool",
    ownerEmail: "another.student@example.test",
    transactionType: "GRANT_PAYMENT",
    txHash: "0xsecond-student-grant-hash",
    blockNumber: 4,
    fromAddress: "0x0000000000000000000000000000000000000001",
    toAddress: "0x0000000000000000000000000000000000000002",
    amount: "500000000000000000000",
    amountDecimals: 18,
    amountDenom: "QOR",
    network: "QoreChain Diana Testnet",
    chainId: 9800,
    milestoneIndex: 0,
    isSimulated: false,
    status: "CONFIRMED",
    gasUsed: "0",
    explorerUrl: "https://explore.qore.network/tx/0xsecond-student-grant-hash",
    createdAt: new Date().toISOString(),
  });
  db.transactions.unshift({
    id: pendingGrantId,
    paymentIntentId: "test_pending_intent",
    applicationId: "test_application",
    poolId: "test_pool",
    txHash: `0x${"a".repeat(64)}`,
    blockNumber: 0,
    fromAddress: "0x0000000000000000000000000000000000000001",
    toAddress: "0x0000000000000000000000000000000000000002",
    amount: "5000000000000000000",
    amountDecimals: 18,
    amountDenom: "QOR",
    network: "QoreChain Diana Testnet",
    chainId: 9800,
    milestoneIndex: 0,
    transactionType: "GRANT_PAYMENT",
    isSimulated: false,
    status: "PENDING",
    gasUsed: "0",
    explorerUrl: "https://explore.qore.network/tx/pending",
    createdAt: new Date().toISOString(),
  });

  try {
    const statsResponse = await fetch(`${baseUrl}/stats`);
    const stats = await statsResponse.json() as {
      completedDisbursements: number;
      pendingDisbursements: number;
      totalDisbursedQOR: number;
      totalFundsDepositedQOR: number;
      recentTransactions: unknown[];
    };
    assert.equal(statsResponse.status, 200);
    assert.equal(stats.completedDisbursements, 2);
    assert.equal(stats.pendingDisbursements, 1);
    assert.equal(stats.totalDisbursedQOR, 502);
    assert.equal(stats.totalFundsDepositedQOR, 10);
    assert.equal(stats.recentTransactions.length, 2);
    assert.equal(
      (stats.recentTransactions[0] as { txHash: string }).txHash,
      "0xsecond-student-grant-hash"
    );

    const studentStatsResponse = await fetch(`${baseUrl.replace("/dashboard", "/student/dashboard")}/stats`, {
      headers: { "x-test-role": "STUDENT" },
    });
    const studentStats = await studentStatsResponse.json() as {
      totalApplications: number;
      totalRequestedQOR: number;
      totalReceivedQOR: number;
      totalFundingAcrossPoolsQOR: number;
    };
    assert.equal(studentStatsResponse.status, 200);
    assert.equal(studentStats.totalApplications, 1);
    assert.equal(studentStats.totalRequestedQOR, 125);
    assert.equal(studentStats.totalReceivedQOR, 0);
    assert.equal(studentStats.totalFundingAcrossPoolsQOR, 0);

    const studentApplicationsResponse = await fetch(
      `${baseUrl.replace("/dashboard", "/student/dashboard")}/applications`,
      { headers: { "x-test-role": "STUDENT" } }
    );
    const studentApplications = await studentApplicationsResponse.json() as { id: string }[];
    assert.deepEqual(studentApplications.map((application) => application.id), [studentApplicationId]);

    const studentTransactionsResponse = await fetch(
      `${baseUrl.replace("/dashboard", "/student/dashboard")}/transactions`,
      { headers: { "x-test-role": "STUDENT" } }
    );
    const studentTransactions = await studentTransactionsResponse.json() as { id: string }[];
    assert.ok(!studentTransactions.some((transaction) => transaction.id === secondStudentGrantId));

    const streamResponse = await fetch(
      `${baseUrl.replace("/dashboard", "/student/dashboard")}/stream`,
      { headers: { "x-test-role": "STUDENT" } }
    );
    assert.equal(streamResponse.status, 200);
    assert.ok(streamResponse.body);
    const streamReader = streamResponse.body.getReader();
    await streamReader.read();
    const activityTimestamp = new Date().toISOString();
    db.sseEmitter.emit("audit", {
      id: "another-student-private-activity",
      action: "OTHER_STUDENT_ACTIVITY",
      applicationId: secondStudentApplicationId,
      createdAt: activityTimestamp,
    });
    db.sseEmitter.emit("audit", {
      id: "this-student-private-activity",
      action: "OWN_STUDENT_ACTIVITY",
      applicationId: studentApplicationId,
      createdAt: activityTimestamp,
    });
    const activityEvent = await streamReader.read();
    const activityPayload = new TextDecoder().decode(activityEvent.value);
    assert.ok(activityPayload.includes("OWN_STUDENT_ACTIVITY"));
    assert.ok(!activityPayload.includes("OTHER_STUDENT_ACTIVITY"));
    await streamReader.cancel();

    const adminStatsResponse = await fetch(`${baseUrl.replace("/dashboard", "/admin/dashboard")}/stats`, {
      headers: { "x-test-role": "ADMIN" },
    });
    const adminStats = await adminStatsResponse.json() as {
      totalApplications: number;
      totalPools: number;
    };
    assert.equal(adminStatsResponse.status, 200);
    assert.ok(adminStats.totalApplications > studentStats.totalApplications);
    assert.ok(adminStats.totalPools >= 0);

    const forbiddenAdminResponse = await fetch(
      `${baseUrl.replace("/dashboard", "/admin/dashboard")}/transactions`,
      { headers: { "x-test-role": "STUDENT" } }
    );
    assert.equal(forbiddenAdminResponse.status, 403);

    const invalidAddressResponse = await fetch(
      `${baseUrl}/native-balance?chainId=9800&address=not-an-address`
    );
    assert.equal(invalidAddressResponse.status, 400);

    const unsupportedNetworkResponse = await fetch(
      `${baseUrl}/native-balance?chainId=1&address=qor1invalid`
    );
    assert.equal(unsupportedNetworkResponse.status, 400);
  } finally {
    db.transactions = db.transactions.filter((tx) =>
      tx.id !== nativeTransferId && tx.id !== pendingGrantId &&
      tx.id !== confirmedGrantId && tx.id !== confirmedPoolFundingId &&
      tx.id !== secondStudentGrantId
    );
    db.applications = db.applications.filter((application) =>
      application.id !== studentApplicationId && application.id !== secondStudentApplicationId
    );
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
