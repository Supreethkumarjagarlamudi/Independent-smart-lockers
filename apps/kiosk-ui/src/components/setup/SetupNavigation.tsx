import { AppButton } from "../ui/AppButton";

type SetupNavigationProps = {
    isFirstStep: boolean;
    isLastStep: boolean;
    onNext(): void;
    onBack(): void;
};

export function SetupNavigation({
    isFirstStep,
    isLastStep,
    onNext,
    onBack,
}: SetupNavigationProps) {
    return (
        <div className="flex gap-4">

            {!isFirstStep && (
                <AppButton
                    variant="secondary"
                    onClick={onBack}
                >
                    Back
                </AppButton>
            )}

            <AppButton onClick={onNext}>
                {isLastStep ? "Finish Setup" : "Next"}
            </AppButton>

        </div>
    );
}