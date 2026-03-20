/**
 * Linear Regression — pure TypeScript, no external dependencies.
 *
 * Uses mini-batch stochastic gradient descent with:
 *   - L2 regularisation (ridge) to prevent overfitting on small datasets
 *   - Adaptive learning rate (simple decay)
 *   - Early stopping on validation loss plateau
 *
 * Suitable for the feature scales produced by featureExtractor.ts.
 */

export interface LinearModel {
  coefficients: number[];   // one per feature
  intercept: number;
  featureNames: string[];
}

export interface TrainResult {
  model: LinearModel;
  mae: number;
  rmse: number;
  r2: number;
  baselineMae: number;
  improvementPct: number;
  epochs: number;
  trainSamples: number;
  valSamples: number;
}

interface Sample { features: number[]; label: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function predict(model: LinearModel, features: number[]): number {
  let y = model.intercept;
  for (let i = 0; i < model.coefficients.length; i++) {
    y += model.coefficients[i] * features[i];
  }
  return y;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeMetrics(model: LinearModel, samples: Sample[]): { mae: number; rmse: number; r2: number } {
  if (samples.length === 0) return { mae: 0, rmse: 0, r2: 0 };

  const labels = samples.map((s) => s.label);
  const mean = labels.reduce((a, b) => a + b, 0) / labels.length;

  let sumAbsErr = 0, sumSqErr = 0, ssTot = 0;
  for (const s of samples) {
    const pred = predict(model, s.features);
    const err = pred - s.label;
    sumAbsErr += Math.abs(err);
    sumSqErr += err * err;
    ssTot += (s.label - mean) ** 2;
  }

  const mae = sumAbsErr / samples.length;
  const rmse = Math.sqrt(sumSqErr / samples.length);
  const r2 = ssTot > 0 ? 1 - sumSqErr / ssTot : 0;
  return { mae, rmse, r2 };
}

// ── Trainer ───────────────────────────────────────────────────────────────────
export function trainLinearRegression(
  dataset: Sample[],
  featureNames: string[],
  options: {
    learningRate?: number;
    maxEpochs?: number;
    batchSize?: number;
    lambda?: number;       // L2 regularisation strength
    valSplit?: number;     // fraction held out for validation
    patience?: number;     // early stopping patience (epochs)
  } = {}
): TrainResult {
  const {
    learningRate = 0.01,
    maxEpochs = 500,
    batchSize = 32,
    lambda = 0.001,
    valSplit = 0.2,
    patience = 20,
  } = options;

  if (dataset.length < 5) {
    throw new Error(`Insufficient training data: ${dataset.length} samples (need ≥ 5)`);
  }

  const nFeatures = featureNames.length;
  const shuffled = shuffle(dataset);
  const splitIdx = Math.floor(shuffled.length * (1 - valSplit));
  const trainSet = shuffled.slice(0, splitIdx);
  const valSet = shuffled.slice(splitIdx);

  // Initialise weights to small random values
  const coefficients = Array.from({ length: nFeatures }, () => (Math.random() - 0.5) * 0.01);
  let intercept = 0;

  let bestValLoss = Infinity;
  let bestCoefficients = [...coefficients];
  let bestIntercept = intercept;
  let patienceCounter = 0;
  let epochsDone = 0;

  for (let epoch = 0; epoch < maxEpochs; epoch++) {
    const epochData = shuffle(trainSet);
    const lr = learningRate / (1 + epoch * 0.001); // mild decay

    // Mini-batch SGD
    for (let b = 0; b < epochData.length; b += batchSize) {
      const batch = epochData.slice(b, b + batchSize);
      const gradCoeff = new Array(nFeatures).fill(0);
      let gradIntercept = 0;

      for (const s of batch) {
        const pred = intercept + coefficients.reduce((sum, c, i) => sum + c * s.features[i], 0);
        const err = pred - s.label;
        for (let i = 0; i < nFeatures; i++) {
          gradCoeff[i] += err * s.features[i];
        }
        gradIntercept += err;
      }

      const n = batch.length;
      for (let i = 0; i < nFeatures; i++) {
        // Gradient + L2 penalty (don't regularise intercept)
        coefficients[i] -= lr * (gradCoeff[i] / n + lambda * coefficients[i]);
      }
      intercept -= lr * (gradIntercept / n);
    }

    // Validation loss (MSE)
    let valLoss = 0;
    for (const s of valSet) {
      const pred = intercept + coefficients.reduce((sum, c, i) => sum + c * s.features[i], 0);
      valLoss += (pred - s.label) ** 2;
    }
    valLoss /= Math.max(1, valSet.length);

    epochsDone = epoch + 1;

    if (valLoss < bestValLoss - 1e-6) {
      bestValLoss = valLoss;
      bestCoefficients = [...coefficients];
      bestIntercept = intercept;
      patienceCounter = 0;
    } else {
      patienceCounter++;
      if (patienceCounter >= patience) break; // early stop
    }
  }

  const model: LinearModel = {
    coefficients: bestCoefficients.map((c) => Math.round(c * 1e6) / 1e6),
    intercept: Math.round(bestIntercept * 1e6) / 1e6,
    featureNames,
  };

  const allMetrics = computeMetrics(model, [...trainSet, ...valSet]);
  const valMetrics = computeMetrics(model, valSet);

  // Baseline: always predict the training mean
  const trainMean = trainSet.reduce((s, x) => s + x.label, 0) / trainSet.length;
  const baselineMae = valSet.reduce((s, x) => s + Math.abs(x.label - trainMean), 0) / Math.max(1, valSet.length);
  const improvementPct = baselineMae > 0
    ? Math.round(((baselineMae - valMetrics.mae) / baselineMae) * 10000) / 100
    : 0;

  return {
    model,
    mae: Math.round(valMetrics.mae * 100) / 100,
    rmse: Math.round(valMetrics.rmse * 100) / 100,
    r2: Math.round(valMetrics.r2 * 10000) / 10000,
    baselineMae: Math.round(baselineMae * 100) / 100,
    improvementPct,
    epochs: epochsDone,
    trainSamples: trainSet.length,
    valSamples: valSet.length,
  };
}

// ── Inference ─────────────────────────────────────────────────────────────────
export function inferLinear(model: LinearModel, features: number[]): number {
  return predict(model, features);
}
