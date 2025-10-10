import React, { useState } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { BottomNavigation } from '../../components/mobile/BottomNavigation';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';

interface MobileCreatePageProps {
  onNavigate?: (page: string) => void;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  multiSelect?: boolean;
}

const createQuestions: Question[] = [
  {
    id: 'vibe',
    question: 'どんな雰囲気のデザインにしたいですか？',
    options: ['minimal', 'street', 'luxury', 'outdoor', 'workwear', 'athleisure'],
  },
  {
    id: 'silhouette',
    question: 'シルエットはどうしますか？',
    options: ['oversized', 'fitted', 'loose', 'tailored', 'relaxed'],
  },
  {
    id: 'color',
    question: 'カラーパレットを選択してください',
    options: ['black', 'white', 'navy', 'earth', 'pastel', 'neon', 'monochrome'],
    multiSelect: true,
  },
  {
    id: 'occasion',
    question: '着用シーンは？',
    options: ['casual', 'business', 'formal', 'sports', 'outdoor'],
  },
  {
    id: 'season',
    question: 'シーズンは？',
    options: ['spring/summer', 'autumn/winter', 'resort', 'all season'],
  },
];

export function MobileCreatePage({ onNavigate }: MobileCreatePageProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentQuestion = createQuestions[currentStep];
  const progress = ((currentStep + 1) / createQuestions.length) * 100;

  const handleSelect = (option: string) => {
    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

    if (currentQuestion.multiSelect) {
      // Multi-select: toggle
      if (currentAnswers.includes(option)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter(a => a !== option),
        });
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, option],
        });
      }
    } else {
      // Single select: replace
      setAnswers({
        ...answers,
        [questionId]: [option],
      });
    }
  };

  const isSelected = (option: string) => {
    const currentAnswers = answers[currentQuestion.id] || [];
    return currentAnswers.includes(option);
  };

  const canProceed = () => {
    const currentAnswers = answers[currentQuestion.id] || [];
    return currentAnswers.length > 0;
  };

  const handleNext = () => {
    if (currentStep < createQuestions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    console.log('Generating with answers:', answers);

    // TODO: Call generation API
    setTimeout(() => {
      setIsGenerating(false);
      alert('生成完了！（実装中）');
      if (onNavigate) {
        onNavigate('mypage');
      }
    }, 2000);
  };

  const handleTabChange = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <>
      <MobileLayout
        title="CREATE"
        showHeader={true}
        showBottomNav={true}
        onMenuClick={() => setIsMenuOpen(true)}
      >
        <div className="create-content">
          {/* Progress bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="progress-text">
              {currentStep + 1} / {createQuestions.length}
            </p>
          </div>

          {!isGenerating ? (
            <>
              {/* Question */}
              <div className="question-container">
                <h2 className="question-text">{currentQuestion.question}</h2>
                {currentQuestion.multiSelect && (
                  <p className="hint-text">複数選択可能です</p>
                )}
              </div>

              {/* Options */}
              <div className="options-container">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    className={`option-btn ${isSelected(option) ? 'selected' : ''}`}
                    onClick={() => handleSelect(option)}
                  >
                    <span className="option-check">
                      {isSelected(option) && '✓'}
                    </span>
                    <span className="option-label">{option}</span>
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="nav-buttons">
                {currentStep > 0 && (
                  <button className="nav-btn secondary" onClick={handleBack}>
                    戻る
                  </button>
                )}
                <button
                  className="nav-btn primary"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {currentStep === createQuestions.length - 1 ? '生成する' : '次へ'}
                </button>
              </div>
            </>
          ) : (
            <div className="generating-container">
              <div className="spinner"></div>
              <p className="generating-text">デザインを生成中...</p>
            </div>
          )}
        </div>
      </MobileLayout>

      <BottomNavigation
        activeTab="create"
        onTabChange={handleTabChange}
      />

      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />

      <style jsx>{`
        .create-content {
          padding: 24px 20px;
          min-height: calc(100vh - 140px);
          display: flex;
          flex-direction: column;
        }

        /* Progress */
        .progress-container {
          margin-bottom: 32px;
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: #E5E5E5;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #000000, #333333);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-family: 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #666666;
          text-align: center;
          margin: 0;
        }

        /* Question */
        .question-container {
          margin-bottom: 32px;
        }

        .question-text {
          font-family: "Noto Sans JP", sans-serif;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.5;
          color: #000000;
          margin: 0 0 8px 0;
        }

        .hint-text {
          font-family: "Noto Sans JP", sans-serif;
          font-size: 13px;
          color: #666666;
          margin: 0;
        }

        /* Options */
        .options-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .option-btn {
          width: 100%;
          padding: 16px 20px;
          background: #FFFFFF;
          border: 2px solid #E5E5E5;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .option-btn:active {
          transform: scale(0.98);
        }

        .option-btn.selected {
          background: #000000;
          border-color: #000000;
        }

        .option-check {
          width: 24px;
          height: 24px;
          border: 2px solid #E5E5E5;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: #FFFFFF;
          transition: all 0.2s ease;
        }

        .option-btn.selected .option-check {
          background: #FFFFFF;
          border-color: #FFFFFF;
          color: #000000;
        }

        .option-label {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #000000;
          transition: color 0.2s ease;
        }

        .option-btn.selected .option-label {
          color: #FFFFFF;
        }

        /* Navigation buttons */
        .nav-buttons {
          display: flex;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #E5E5E5;
        }

        .nav-btn {
          flex: 1;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-btn.primary {
          background: #000000;
          color: #FFFFFF;
        }

        .nav-btn.primary:disabled {
          background: #CCCCCC;
          cursor: not-allowed;
        }

        .nav-btn.primary:active:not(:disabled) {
          background: #333333;
        }

        .nav-btn.secondary {
          background: #FFFFFF;
          color: #000000;
          border: 2px solid #E5E5E5;
        }

        .nav-btn.secondary:active {
          background: #F5F5F5;
        }

        /* Generating */
        .generating-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #E5E5E5;
          border-top-color: #000000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .generating-text {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #666666;
          margin: 0;
        }
      `}</style>
    </>
  );
}
