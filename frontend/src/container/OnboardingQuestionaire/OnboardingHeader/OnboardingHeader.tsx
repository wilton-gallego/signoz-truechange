import './OnboardingHeader.styles.scss';

export function OnboardingHeader(): JSX.Element {
	return (
		<div className="header-container">
			<div className="logo-container">
				<img src="/Logos/trueview-brand-logo.svg" alt="Trueview" />
				<span className="logo-text">Trueview</span>
			</div>
		</div>
	);
}
