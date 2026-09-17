interface Factor {
  name: string;
  score: number;
  description: string;
}

interface ExplanationCardProps {
  factors: Factor[];
  title?: string;
}

export default function ExplanationCard({
  factors,
  title = "AI Decision Attributes (SHAP/Explainability Analysis)",
}: ExplanationCardProps) {
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-5 select-none">
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 font-mono">
        {title}
      </h3>
      <div className="space-y-4">
        {factors.map((factor, index) => {
          const isPositive = factor.score >= 0;
          const absoluteScore = Math.abs(factor.score);
          const maxImpact = Math.max(...factors.map((f) => Math.abs(f.score)), 1.0);
          const barWidthPercent = Math.min((absoluteScore / maxImpact) * 100, 100);

          return (
            <div key={index} className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold">{factor.name}</span>
                <span className={isPositive ? "text-red-400" : "text-emerald-400"}>
                  {isPositive ? "+" : "-"}
                  {absoluteScore.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                {isPositive ? (
                  <>
                    <div className="w-1/2"></div>
                    <div
                      className="bg-red-500/80 rounded-r-full"
                      style={{ width: `${barWidthPercent / 2}%` }}
                    ></div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex justify-end">
                      <div
                        className="bg-emerald-500/80 rounded-l-full"
                        style={{ width: `${barWidthPercent / 2}%` }}
                      ></div>
                    </div>
                    <div className="w-1/2"></div>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-500 leading-normal italic">
                {factor.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
