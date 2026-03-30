export const termsDisclaimerParagraphs = [
	`FuelWatch PH is an informational platform that aggregates fuel prices and availability from user reports and third-party sources. The information displayed is provided "as is" and may not always be accurate, complete, or up to date.`,
	"Fuel prices, stock levels, and station conditions are subject to change without prior notice. FuelWatch PH does not guarantee the accuracy or reliability of the data presented and shall not be held liable for any discrepancies, losses, or decisions made based on the information provided.",
	"Users are strongly encouraged to confirm fuel prices and availability directly with the respective fuel stations.",
];

export const privacyPolicySections = [
	{
		title: "Information We Collect",
		paragraphs: [
			"FuelWatch PH may collect account information such as your email address, display name, and profile image when you sign in or update your profile.",
			"We may also collect report submissions, fuel station updates, and location-related data that you choose to provide while using the app's reporting and map features.",
		],
	},
	{
		title: "How We Use Information",
		paragraphs: [
			"We use collected information to operate the platform, display station updates, personalize your account, support map-based features, and improve the quality of fuel price reporting.",
			"Information may also be used to help moderate reports, prevent abuse, maintain service security, and troubleshoot technical issues.",
		],
	},
	{
		title: "Sharing and Third-Party Services",
		paragraphs: [
			"FuelWatch PH may rely on third-party services such as authentication, storage, analytics, and mapping providers to deliver parts of the service.",
			"We do not sell your personal information, but limited data may be processed by service providers when necessary to run the platform or comply with legal obligations.",
		],
	},
	{
		title: "Your Choices",
		paragraphs: [
			"You may update your profile details, limit what information you submit, or stop using location-enabled features at any time through your device or browser settings.",
			"If you have questions about your data or need account-related assistance, please contact the app administrator or maintainer responsible for FuelWatch PH.",
		],
	},
];

export const aboutUsSections = [
	{
		title: "Who We Are",
		paragraphs: [
			"FuelWatch PH is a community-powered platform that helps drivers across the Philippines find and share fuel prices in their area.",
			"We built FuelWatch PH with one simple goal: help Filipinos make smarter decisions before they fill up.",
			"We rely on real user reports to provide fuel price insights across the country. While prices may vary, every contribution helps build a more transparent and informed fueling experience.",
		],
	},
	{
		title: "Our Mission",
		paragraphs: [
			"To provide accessible, transparent, and community-driven fuel price information that empowers every Filipino driver to save money and plan better.",
		],
	},
	{
		title: "What We Do",
		paragraphs: [
			"FuelWatch PH allows users to:",
			"All data is crowd-sourced, meaning it comes from real users on the ground.",
		],
		bullets: [
			"📍 View nearby fuel stations based on location",
			"⛽ Check reported fuel prices (Unleaded, Premium, Diesel)",
			"📊 See average fuel prices in different areas",
			"🧑‍🤝‍🧑 Contribute by reporting updated fuel prices",
			"🗺️ Explore stations through an interactive map",
		],
	},
	{
		title: "Why FuelWatch PH Exists",
		paragraphs: [
			"Fuel prices change frequently sometimes even within the same day.",
			"In many areas, there is no easy way to compare prices between nearby stations, know where to get the best deal, or stay updated without physically visiting each station.",
			"FuelWatch PH solves this by turning everyday drivers into contributors.",
		],
	},
	{
		title: "Transparency & Disclaimer",
		paragraphs: [
			"FuelWatch PH relies on user-submitted data.",
			"Prices may not always be real-time or fully accurate. Availability status may change without notice. Users are encouraged to verify prices at the station before refueling.",
			"We aim to improve accuracy over time through community participation and smarter validation systems.",
		],
	},
	{
		title: "Our Vision",
		paragraphs: [
			"To become the most trusted fuel information platform in the Philippines, helping millions of drivers save money daily.",
			"In the future, we aim to introduce:",
		],
		bullets: [
			"👉 Smarter price validation",
			"👉 Station owner verification tools",
			"👉 Real-time integrations",
			"👉 Nationwide coverage",
		],
	},
	{
		title: "Join the Community",
		paragraphs: [
			"FuelWatch PH is built by the community, for the community.",
			"Every report helps another driver save.",
			"👉 Start exploring, contribute fuel prices, and help build a smarter way to fuel up.",
		],
	},
] as const;

export const contactUsIntro =
	"Need help, have feedback, or want to reach the FuelWatch PH team? You can contact us through the channels below and we’ll do our best to respond.";

export const contactUsChannels = [
	{
		title: "Email",
		description:
			"Send questions, feedback, bug reports, or account concerns through email.",
		label: "jbalums@gmail.com",
		href: "mailto:jbalums@gmail.com",
	},
	{
		title: "Facebook",
		description:
			"Follow updates or send us a message through the official FuelWatch PH Facebook page.",
		label: "facebook.com/fuelwatchph",
		href: "https://www.facebook.com/fuelwatchph",
	},
] as const;

export const contactUsSections = [
	{
		title: "When to Contact Us",
		paragraphs: [
			"Reach out if you have questions about FuelWatch PH, need help using the platform, want to report inaccurate information, or have suggestions that can improve the experience for other drivers.",
		],
	},
	{
		title: "Response Expectations",
		paragraphs: [
			"We may not always be able to respond immediately, but we review messages and community feedback to help improve FuelWatch PH over time.",
		],
	},
] as const;
