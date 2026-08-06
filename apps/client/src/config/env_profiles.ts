export type AppMode = "dev" | "prod";

export interface EnvProfile {
	apiUrl: string;
	domain: string;
	authDomain: string;
	siteUrl: string;
}

const prodDomain = "https://api.trtst.com";

export const ENV_PROFILES: Record<AppMode, EnvProfile> = {
	dev: {
		apiUrl: "http://127.0.0.1:3100/api",
		domain: "http://127.0.0.1:3100",
		authDomain: "http://127.0.0.1:3100",
		siteUrl: "http://127.0.0.1:5176"
	},
	prod: {
		apiUrl: `${prodDomain}/api`,
		domain: prodDomain,
		authDomain: prodDomain,
		siteUrl: "https://www.trtst.com"
	}
};
