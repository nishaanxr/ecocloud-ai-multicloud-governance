-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- 1. Jobs Table: stores workload specifications and requirements
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    workload_name TEXT NOT NULL,
    cpu REAL NOT NULL,
    memory REAL NOT NULL,
    storage REAL NOT NULL,
    duration REAL NOT NULL,
    max_cost REAL,
    max_latency REAL,
    data_residency TEXT,
    priority TEXT,
    optimization_mode TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Cloud Options Table: stores fetched and normalized cloud candidate options
CREATE TABLE IF NOT EXISTS cloud_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    cloud TEXT NOT NULL,
    service TEXT NOT NULL,
    region TEXT NOT NULL,
    pricing REAL,
    carbon_intensity REAL,
    latency REAL,
    feasible INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

-- 3. Decisions Table: stores governance decisions from Gemini Agent or Baseline
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    cloud TEXT NOT NULL,
    service TEXT NOT NULL,
    region TEXT NOT NULL,
    estimated_cost REAL NOT NULL,
    carbon_intensity REAL,
    estimated_carbon REAL,
    latency REAL,
    decision_source TEXT NOT NULL,
    reasoning TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

-- 4. Tool Calls Table: tracks each native function/tool call made during reasoning
CREATE TABLE IF NOT EXISTS tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id INTEGER,
    tool_name TEXT NOT NULL,
    input TEXT,
    output TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

-- 5. Simulations Table: records simulated execution results for chosen placement
CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    cloud TEXT NOT NULL,
    region TEXT NOT NULL,
    service TEXT NOT NULL,
    execution_time REAL,
    average_cpu REAL,
    average_memory REAL,
    estimated_cost REAL,
    estimated_carbon REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_cloud_options_job_id ON cloud_options(job_id);
CREATE INDEX IF NOT EXISTS idx_decisions_job_id ON decisions(job_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_decision_id ON tool_calls(decision_id);
CREATE INDEX IF NOT EXISTS idx_simulations_job_id ON simulations(job_id);
