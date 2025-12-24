/**
 * 에러 메시지에서 내부 IP 주소와 민감한 정보를 마스킹하는 유틸리티 함수
 */

/**
 * IP 주소를 마스킹합니다 (모든 IPv4 주소 포함)
 * 예: 192.168.1.154 -> [REDACTED], 1.245.47.108 -> [REDACTED]
 */
function maskIpAddress(text: string): string {
	// 모든 IPv4 주소 패턴 (0.0.0.0 ~ 255.255.255.255)
	// 단, 이미 [REDACTED]로 마스킹된 것은 제외
	const ipv4Pattern = /\b(?<!\[REDACTED\]\s*)(?:\d{1,3}\.){3}\d{1,3}\b/gi;
	
	// IPv6 주소 패턴 (간단한 패턴)
	const ipv6Pattern = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:::1|fe80::|::ffff:)/gi;
	
	// localhost도 마스킹
	const localhostPattern = /\blocalhost\b/gi;
	
	let sanitized = text;
	
	// IPv4 주소 마스킹 (모든 IP 주소)
	sanitized = sanitized.replace(ipv4Pattern, '[REDACTED]');
	
	// IPv6 주소 마스킹
	sanitized = sanitized.replace(ipv6Pattern, '[REDACTED]');
	
	// localhost 마스킹
	sanitized = sanitized.replace(localhostPattern, '[REDACTED]');
	
	return sanitized;
}

/**
 * URL에서 모든 IP 주소를 마스킹하고 경로 정보를 제거합니다
 */
function maskUrl(text: string): string {
	// http://IP:port/path 또는 https://IP:port/path 패턴 (모든 IP 주소 포함)
	// IP 주소는 \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3} 패턴으로 매칭
	const fullUrlPattern = /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s]*)?/gi;
	
	// 프로토콜 없는 URL 패턴 (예: IP:port/path 또는 [REDACTED]/path)
	// IP 주소나 [REDACTED] 뒤에 오는 경로 정보 제거
	const pathOnlyPattern = /(?:(?:\d{1,3}\.){3}\d{1,3}|\[REDACTED\]|localhost)(?::\d+)?\/[^\s]*/gi;
	
	// "Failed to parse URL from" 같은 패턴에서 URL 부분 전체 제거
	// 모든 IP 주소 패턴 포함
	const parseUrlPattern = /(Failed to parse URL from\s+)(?:https?:\/\/)?(?:(?:\d{1,3}\.){3}\d{1,3}|\[REDACTED\]|localhost)(?::\d+)?(?:\/[^\s]*)?/gi;
	
	let sanitized = text;
	
	// "Failed to parse URL from" 패턴 처리 (전체 URL 부분 제거)
	sanitized = sanitized.replace(parseUrlPattern, '$1[REDACTED]');
	
	// 전체 URL 패턴 마스킹 (경로 정보 포함 제거)
	sanitized = sanitized.replace(fullUrlPattern, '[REDACTED]');
	
	// 프로토콜 없는 경로 패턴 마스킹 (IP 주소와 경로 정보 제거)
	sanitized = sanitized.replace(pathOnlyPattern, '[REDACTED]');
	
	return sanitized;
}

/**
 * 에러 메시지에서 민감한 정보를 제거합니다
 * - 모든 IP 주소 (사설 IP, 공인 IP 포함)
 * - URL 경로 정보
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

