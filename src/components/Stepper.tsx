import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="w-full py-4 sm:py-6 overflow-x-auto">
      <div className="flex items-center justify-between min-w-max sm:min-w-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center flex-1 min-w-[80px] sm:min-w-0">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-600 dark:bg-green-700 border-green-600 dark:border-green-700'
                      : isCurrent
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  ) : (
                    <span
                      className={`text-xs sm:text-sm ${
                        isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {stepNumber}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-center px-1">
                  <p
                    className={`text-xs sm:text-sm font-medium ${
                      isCurrent ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{step.description}</p>
                  )}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 ${
                    stepNumber < currentStep ? 'bg-green-600 dark:bg-green-500' : 'bg-border'
                  }`}
                  style={{ maxWidth: '60px', minWidth: '30px' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}