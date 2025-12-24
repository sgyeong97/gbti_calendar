/**
 * 에러 메시지에서 내부 IP 주소와 민감한 정보를 마스킹하는 유틸리티 함수
 */

/**
 * IP 주소를 마스킹합니다 (예: 192.168.1.154 -> [REDACTED])
 */
function maskIpAddress(text: string): string {
	// IPv4 주소 패턴 (192.168.x.x, 10.x.x.x, 172.16-31.x.x 등 사설 IP)
	const ipv4Pattern = /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)\b/gi;
	
	// IPv6 로컬 주소 패턴
	const ipv6Pattern = /\b(?:::1|fe80::|::ffff:)/gi;
	
	let sanitized = text;
	
	// IPv4 주소 마스킹
	sanitized = sanitized.replace(ipv4Pattern, '[REDACTED]');
	
	// IPv6 주소 마스킹
	sanitized = sanitized.replace(ipv6Pattern, '[REDACTED]');
	
	return sanitized;
}

/**
 * URL에서 내부 IP 주소를 마스킹하고 경로 정보를 제거합니다
 */
function maskUrl(text: string): string {
	// http://192.168.x.x:port 또는 https://192.168.x.x:port 패턴 (전체 URL 마스킹)
	const fullUrlPattern = /https?:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(?::\d+)?(?:\/[^\s]*)?/gi;
	
	// 프로토콜 없는 URL 패턴 (예: [REDACTED]/discord-activity/... 또는 192.168.x.x/discord-activity/...)
	const pathOnlyPattern = /(?:\[REDACTED\]|(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost))(?::\d+)?\/[^\s]*/gi;
	
	// "Failed to parse URL from" 같은 패턴에서 URL 부분 전체 제거
	const parseUrlPattern = /(Failed to parse URL from\s+)(?:https?:\/\/)?(?:\[REDACTED\]|(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost))(?::\d+)?(?:\/[^\s]*)?/gi;
	
	let sanitized = text;
	
	// "Failed to parse URL from" 패턴 처리 (전체 URL 부분 제거)
	sanitized = sanitized.replace(parseUrlPattern, '$1[REDACTED]');
	
	// 전체 URL 패턴 마스킹
	sanitized = sanitized.replace(fullUrlPattern, '[REDACTED]');
	
	// 프로토콜 없는 경로 패턴 마스킹
	sanitized = sanitized.replace(pathOnlyPattern, '[REDACTED]');
	
	return sanitized;
}

/**
 * 에러 메시지에서 민감한 정보를 제거합니다
 * - 내부 IP 주소
 * - 내부 URL
 * - 기타 민감한 정보
 */
export function sanitizeErrorMessage(message: string | undefined | null): string {
	if (!message) {
		return 'An error occurred';
	}
	
	let sanitized = String(message);
	
	// URL 마스킹 (IP가 포함된 URL)
	sanitized = maskUrl(sanitized);
	
	// 남은 IP 주소 마스킹
	sanitized = maskIpAddress(sanitized);
	
	return sanitized;
}

/**
 * 에러 객체에서 안전한 메시지를 추출합니다
 */
export function getSafeErrorMessage(err: any): string {
	if (!err) {
		return 'An error occurred';
	}
	
	// err.message가 있으면 사용
	if (err.message) {
		return sanitizeErrorMessage(err.message);
	}
	
	// err.toString() 결과 사용
	if (typeof err.toString === 'function') {
		return sanitizeErrorMessage(err.toString());
	}
	
	// 마지막으로 String 변환
	return sanitizeErrorMessage(String(err));
}

