import { cfg } from "@/config";
import { get } from "./http";

export interface LoginImageConfig {
	imageUrl: string | null;
}

export interface CookAssistantActivityConfig {
	activityEnabled: boolean;
	startsAt: string | null;
	endsAt: string | null;
	timeZone: string;
	dailyUnlockLimit: number;
	tipText: string;
}

export interface AppConfigResponse {
	login: LoginImageConfig;
	cookAssistant: CookAssistantActivityConfig;
}

export const appConfigApi = {
	getPublic() {
		return get<AppConfigResponse>(`${cfg.domain}/api/app-config`, undefined, { auth: false });
	}
};
