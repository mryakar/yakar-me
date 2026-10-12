interface TrustedTypePolicyOptions {
  createScriptURL?: (input: string) => string;
}

interface TrustedTypePolicyFactory {
  readonly defaultPolicy: object | null;
  createPolicy(name: string, options: TrustedTypePolicyOptions): object;
}

declare var trustedTypes: TrustedTypePolicyFactory | undefined;
