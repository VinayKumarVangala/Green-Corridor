// ==========================================
// Lightweight In-Process Job Queue
// ==========================================
// No Redis required. Uses setTimeout-based scheduling
// with exponential backoff for retries.
// Suitable for MVP; swap for BullMQ/Vercel KV in production.

export type JobStatus = "pending" | "running" | "completed" | "failed" | "retrying";

export interface Job {
  id: string;
  name: string;
  data: Record<string, any>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

type JobHandler = (data: Record<string, any>) => Promise<void>;

const jobRegistry: Map<string, JobHandler> = new Map();
const activeJobs: Map<string, Job> = new Map();

let jobCounter = 0;

// ==========================================
// Register Job Handlers
// ==========================================
export function registerJobHandler(name: string, handler: JobHandler): void {
  jobRegistry.set(name, handler);
  console.log(`[JobProcessor] Registered handler: ${name}`);
}

// ==========================================
// Enqueue a Job
// ==========================================
export function enqueueJob(
  name: string,
  data: Record<string, any>,
  options: { maxAttempts?: number; delayMs?: number } = {}
): string {
  const jobId = `job_${++jobCounter}_${Date.now()}`;
  const job: Job = {
    id: jobId,
    name,
    data,
    status: "pending",
    attempts: 0,
    maxAttempts: options.maxAttempts || 3,
    createdAt: new Date(),
  };

  activeJobs.set(jobId, job);

  // Schedule execution
  const delay = options.delayMs || 0;
  setTimeout(() => executeJob(jobId), delay);

  console.log(`[JobProcessor] Enqueued: ${name} (${jobId}) — delay: ${delay}ms`);
  return jobId;
}

// ==========================================
// Execute a Job
// ==========================================
async function executeJob(jobId: string): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const handler = jobRegistry.get(job.name);
  if (!handler) {
    job.status = "failed";
    job.error = `No handler registered for job: ${job.name}`;
    console.error(`[JobProcessor] ${job.error}`);
    return;
  }

  job.status = "running";
  job.attempts++;
  job.lastAttemptAt = new Date();

  try {
    await handler(job.data);
    job.status = "completed";
    console.log(`[JobProcessor] Completed: ${job.name} (${jobId}) — attempt ${job.attempts}`);
    
    // Cleanup completed jobs after 5 minutes
    setTimeout(() => activeJobs.delete(jobId), 5 * 60 * 1000);
  } catch (error: any) {
    console.error(`[JobProcessor] Failed: ${job.name} (${jobId}) — attempt ${job.attempts}:`, error.message);

    if (job.attempts < job.maxAttempts) {
      job.status = "retrying";
      job.error = error.message;
      // Exponential backoff: 2s, 4s, 8s...
      const backoff = Math.pow(2, job.attempts) * 1000;
      console.log(`[JobProcessor] Retrying ${job.name} in ${backoff}ms (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      setTimeout(() => executeJob(jobId), backoff);
    } else {
      job.status = "failed";
      job.error = `Max attempts (${job.maxAttempts}) exceeded. Last error: ${error.message}`;
      console.error(`[JobProcessor] PERMANENTLY FAILED: ${job.name} (${jobId})`);
    }
  }
}

// ==========================================
// Job Status Query
// ==========================================
export function getJobStatus(jobId: string): Job | undefined {
  return activeJobs.get(jobId);
}

export function getAllJobs(): Job[] {
  return Array.from(activeJobs.values());
}

export function getJobsByStatus(status: JobStatus): Job[] {
  return Array.from(activeJobs.values()).filter((j) => j.status === status);
}
