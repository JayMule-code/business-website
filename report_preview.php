<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';

$user = require_auth();
$selectedId = trim((string) ($_GET['id'] ?? ''));
$detail = $selectedId !== '' ? fetch_offense_detail($selectedId) : null;
$offenses = $detail ? [] : fetch_offenses($_GET);
$dashboard = dashboard_snapshot();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RTSA Report Preview</title>
<style>
body{font-family:Arial,sans-serif;background:#f5f7fb;color:#1a1f2e;margin:0;padding:32px}
.wrap{max-width:980px;margin:0 auto;background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 30px rgba(16,24,40,.08)}
h1,h2{margin:0 0 12px}
.meta{color:#52627a;font-size:14px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
.card{border:1px solid #d9e2ef;border-radius:12px;padding:16px;background:#fbfdff}
table{width:100%;border-collapse:collapse;margin-top:18px}
th,td{border:1px solid #d9e2ef;padding:10px;text-align:left;font-size:14px}
th{background:#eff5ff}
.actions{margin-top:20px}
@media print {.actions{display:none} body{padding:0;background:#fff}.wrap{box-shadow:none;padding:0}}
@media (max-width:700px){body{padding:14px}.wrap{padding:18px}.grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<div class="wrap">
  <h1>Traffic Offense Report Preview</h1>
  <div class="meta">Generated for <?= htmlspecialchars($user['first_name'] . ' ' . $user['last_name']) ?> on <?= date('Y-m-d H:i:s') ?></div>

  <?php if ($detail): ?>
    <h2>Detailed Offense Report: <?= htmlspecialchars($detail['offense_code']) ?></h2>
    <div class="grid">
      <div class="card"><strong>Driver</strong><br><?= htmlspecialchars($detail['driver_name']) ?></div>
      <div class="card"><strong>Plate</strong><br><?= htmlspecialchars($detail['vehicle_plate']) ?></div>
      <div class="card"><strong>Offense</strong><br><?= htmlspecialchars($detail['offense_type']) ?></div>
      <div class="card"><strong>Status</strong><br><?= htmlspecialchars($detail['status']) ?></div>
    </div>
    <table>
      <tr><th>Location</th><td><?= htmlspecialchars($detail['location']) ?></td></tr>
      <tr><th>Occurred At</th><td><?= htmlspecialchars((string) $detail['occurred_at']) ?></td></tr>
      <tr><th>Fine Amount</th><td>ZMW <?= number_format((float) $detail['fine_amount'], 2) ?></td></tr>
      <tr><th>Demerit Points</th><td><?= htmlspecialchars((string) $detail['demerit_points']) ?></td></tr>
      <tr><th>Officer</th><td><?= htmlspecialchars((string) $detail['officer_name']) ?></td></tr>
      <tr><th>Notes</th><td><?= nl2br(htmlspecialchars((string) $detail['notes'])) ?></td></tr>
    </table>

    <h2 style="margin-top:24px">Transactions</h2>
    <table>
      <thead><tr><th>Transaction</th><th>Method</th><th>Account</th><th>Amount</th><th>Status</th><th>Processed At</th></tr></thead>
      <tbody>
      <?php foreach ($detail['transactions'] as $transaction): ?>
        <tr>
          <td><?= htmlspecialchars($transaction['transaction_code']) ?></td>
          <td><?= htmlspecialchars($transaction['method']) ?></td>
          <td><?= htmlspecialchars($transaction['account_reference']) ?></td>
          <td>ZMW <?= number_format((float) $transaction['amount'], 2) ?></td>
          <td><?= htmlspecialchars($transaction['status']) ?></td>
          <td><?= htmlspecialchars((string) $transaction['processed_at']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php else: ?>
    <h2>Filtered Offense Summary</h2>
    <div class="grid">
      <div class="card"><strong>Offenses Today</strong><br><?= (int) $dashboard['totals']['offenses_today'] ?></div>
      <div class="card"><strong>Pending Fines</strong><br><?= (int) $dashboard['totals']['pending_fines'] ?></div>
      <div class="card"><strong>Revenue</strong><br>ZMW <?= number_format((float) $dashboard['totals']['revenue'], 2) ?></div>
      <div class="card"><strong>Active Officers</strong><br><?= (int) $dashboard['totals']['active_officers'] ?></div>
    </div>
    <table>
      <thead><tr><th>Offense ID</th><th>Driver</th><th>Plate</th><th>Type</th><th>Status</th><th>Fine</th></tr></thead>
      <tbody>
      <?php foreach ($offenses as $offense): ?>
        <tr>
          <td><?= htmlspecialchars($offense['offense_code']) ?></td>
          <td><?= htmlspecialchars($offense['driver_name']) ?></td>
          <td><?= htmlspecialchars($offense['vehicle_plate']) ?></td>
          <td><?= htmlspecialchars($offense['offense_type']) ?></td>
          <td><?= htmlspecialchars($offense['status']) ?></td>
          <td>ZMW <?= number_format((float) $offense['fine_amount'], 2) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>

  <div class="actions">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
</div>
</body>
</html>
