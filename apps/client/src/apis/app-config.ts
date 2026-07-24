import { cfg } from "@/config";
import { get } from "./http";

export interface LoginImageConfig {
	imageUrl: string | null;
}

export interface AppConfigResponse {
	login: LoginImageConfig;
}

export const appConfigApi = {
	getPublic() {
		return get<AppConfigResponse>(`${cfg.domain}/api/app-config`, undefined, { auth: false });
	}
};
