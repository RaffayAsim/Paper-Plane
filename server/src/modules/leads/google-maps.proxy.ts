import axios from "axios";

export type GoogleMapsProxy = {
  protocol: "http" | "https" | "socks4" | "socks5";
  host: string;
  port: number;
  username?: string;
  password?: string;
};

class GoogleMapsProxyManager {
  private proxies: GoogleMapsProxy[] = [];
  private currentIndex = 0;

  private readonly proxyUrls = {
    socks5: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt",
    socks4: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt",
    http: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
  };

  async loadProxies(): Promise<void> {
    if (this.proxies.length > 0) {
      return;
    }

    try {
      const [socks5Response, socks4Response, httpResponse] = await Promise.all([
        axios.get(this.proxyUrls.socks5),
        axios.get(this.proxyUrls.socks4),
        axios.get(this.proxyUrls.http),
      ]);

      this.proxies.push(...this.parseProxyList(socks5Response.data, "socks5"));
      this.proxies.push(...this.parseProxyList(socks4Response.data, "socks4"));
      this.proxies.push(...this.parseProxyList(httpResponse.data, "http"));
      this.shuffle(this.proxies);
    } catch (error) {
      console.error("Failed to load Google Maps proxy lists:", error);
    }
  }

  getNextProxy(): GoogleMapsProxy | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }

  isEmpty() {
    return this.proxies.length === 0;
  }

  getPuppeteerArgs(proxy?: GoogleMapsProxy): string[] {
    const args: string[] = ["--no-sandbox", "--disable-setuid-sandbox"];

    if (!proxy) {
      return args;
    }

    if (proxy.protocol === "socks4" || proxy.protocol === "socks5") {
      args.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
    } else {
      args.push(`--proxy-server=${proxy.host}:${proxy.port}`);
    }

    return args;
  }

  private parseProxyList(value: string, protocol: GoogleMapsProxy["protocol"]) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [host, port] = line.split(":");
        return {
          protocol,
          host,
          port: Number(port),
        } satisfies GoogleMapsProxy;
      })
      .filter((proxy) => proxy.host && Number.isInteger(proxy.port) && proxy.port > 0 && proxy.port < 65536);
  }

  private shuffle<T>(items: T[]) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }
}

export const googleMapsProxyManager = new GoogleMapsProxyManager();
