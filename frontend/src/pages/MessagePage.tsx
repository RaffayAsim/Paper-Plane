import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, RefreshCw, Send, Sparkles, Calendar, ArrowLeft, ArrowRight, Clock, Users, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadImportWorkspace } from "./CreateLeadsPage";
import { useAuth } from "@/contexts/AuthContext";

const batchSizes = ["10", "25", "50", "250", "500"] as const;

type Lead = {
  id: string;
  name: string;
  business: string;
  email?: string | null;
  location?: string | null;
  metadata?: Record<string, any> | null;
  campaign?: { id: string; businessType: string } | null;
  emailStatus?: {
    sent: boolean;
    sentCount: number;
    lastSentAt: string | null;
  };
};

const PREBUILT_TEMPLATES = [
  {
    name: "🎂 Birthday Catering Offer (Vesela Pani)",
    subject: "Free Syrnyky + €20 gift card + 10% off catering — for your birthday!",
    customizerDefaults: {
      business_name: "Vesela Pani",
      logo_url: "https://drive.google.com/uc?export=view&id=1D3sOi4os9E47-Vd8slGIeNPXqRlzjJJO",
      promo_title: "Free Syrnyky + €20 gift card + 10% off catering — for your birthday.",
      coupon_code: "BIRTHDAY20",
      discount_value: "€20",
      cta_text: "Request the catering",
      cta_link: "mailto:ukrainianfood@vesela-pani.nl?subject=Claim%20Your%20Birthday%20Gift&body=Hi%20Team,%0D%0A%0D%0AI%20would%20like%20to%20claim%20my%20birthday%20gift%20and%20preorder:%0D%0A[ ] Salad%0D%0A[ ] Cake%0D%0A%0D%0AName:%20_________%0D%0APhone:%20_________%0D%0APickup/Delivery%20Date:%20_________",
      prod1_name: "Herring Under Fur Coat (салат Шуба)",
      prod1_price: "€23 / 1 kg",
      prod1_image: "https://drive.google.com/uc?export=view&id=1h3QQmMf-hMMhwb576rePf9XjavChPrLX",
      prod2_name: "A-lya Olivier (lighter, tastier classic)",
      prod2_price: "€23 / 1 kg",
      prod2_image: "https://drive.google.com/uc?export=view&id=1_1_KIZ4LO1-8NXYNoBBuHZQ3Khl2nTYE",
      prod3_name: "Napoleon",
      prod3_price: "€55 (8–10 servings)",
      prod3_image: "https://drive.google.com/uc?export=view&id=1o239ZBFkkpfMj2MKEhl0DhNYwCTtVpmD",
      prod4_name: "Honey Cake (Medovyk)",
      prod4_price: "€52 (8–10 servings)",
      prod4_image: "https://drive.google.com/uc?export=view&id=1g8eAWTZzBH7IYdkfG31H5Fs1Nl04U90H",
      product_header_1: "🍴 Customer favorites for the birthday catering",
      product_header_2: "Fresh cakes from Lila Bakery (no extra discount):",
      promo_terms: "Preorders: please order cakes and catering at least 10 days before pickup/delivery.",
      show_product_header_1: "true", show_product_header_2: "true",
      show_product_row1: "true", show_product_row2: "true",
      show_prod1_price: "true", show_prod1_image: "true",
      show_prod2_price: "true", show_prod2_image: "true",
      show_prod3_price: "true", show_prod3_image: "true",
      show_prod4_price: "true", show_prod4_image: "true",
      show_coupon_box: "true", show_promo_terms: "true",
      show_logo: "true", show_promo_banner: "true", show_intro_text: "true",
      show_cta: "true", show_footer: "true",
    },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Birthday Celebration</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F5F5F0; color: #333;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
        <tr>
            <td align="center">
                <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
                    {{#if_show_logo}}<tr>
                        <td align="center" class="logo" style="text-align: center; padding: 20px;">
                            <img src="{{logo_url}}" alt="{{business_name}} Logo" style="max-height:80px; max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto;">
                        </td>
                    </tr>{{/if_show_logo}}
                    {{#if_show_promo_banner}}<tr>
                        <td class="header" style="background-color: #2E7D32; color: #fff; text-align: center; font-size: 20px; font-weight: bold; padding: 20px;">
                            {{promo_title}}
                        </td>
                    </tr>{{/if_show_promo_banner}}
                    <tr>
                        <td class="content" style="padding: 20px; font-size: 16px; line-height: 24px;">
                            <p style="margin-top: 0;">Dear <b>{{name}}</b>,</p>
                            {{#if_show_intro_text}}<p>Congratulations with&nbsp;your&nbsp;birthday! 🥳</p>

                            <h3 style="margin-top: 30px;">🎁 A little birthday surprise from us</h3>
                            <p>To celebrate your special day, we’ve prepared a few complimentary treats just for you:</p>

                            <p>1️⃣ A free package of <strong>Syrnyky</strong> — our gift to you, which you can pick up at the shop or have added to your next order.</p>
                            <p>2️⃣ A <strong>{{discount_value}} gift card</strong> for your next visit — redeem it in the shop or use promo code <strong>{{coupon_code}}</strong> at checkout.</p>
                            <p>3️⃣ <strong>10% off our catering menu</strong> when you’re planning your celebration (we can offer tasty food that matches your taste and budget — just share your preferences with us).</p>{{/if_show_intro_text}}

                            {{#if_show_product_header_1}}<h3 style="margin-top: 30px;">{{product_header_1}}</h3>{{/if_show_product_header_1}}
                            {{#if_show_product_row1}}<table class="menu-grid" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px;">
                                        {{#if_show_prod1_image}}<img src="{{prod1_image}}" alt="{{prod1_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 250px; height: 160px; object-fit: cover;">{{/if_show_prod1_image}}
                                        <p style="margin: 8px 0 0 0; font-size: 14px;"><b>{{prod1_name}}</b><br>{{#if_show_prod1_price}}{{prod1_price}}{{/if_show_prod1_price}}</p>
                                    </td>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px;">
                                        {{#if_show_prod2_image}}<img src="{{prod2_image}}" alt="{{prod2_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 250px; height: 160px; object-fit: cover;">{{/if_show_prod2_image}}
                                        <p style="margin: 8px 0 0 0; font-size: 14px;"><b>{{prod2_name}}</b><br>{{#if_show_prod2_price}}{{prod2_price}}{{/if_show_prod2_price}}</p>
                                    </td>
                                </tr>
                            </table>{{/if_show_product_row1}}
                            {{#if_show_product_header_2}}<p style="margin-top: 30px;"><b>{{product_header_2}}</b></p>{{/if_show_product_header_2}}

                            {{#if_show_product_row2}}<table class="menu-grid" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px;">
                                        {{#if_show_prod3_image}}<img src="{{prod3_image}}" alt="{{prod3_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 250px; height: 160px; object-fit: cover;">{{/if_show_prod3_image}}
                                        <p style="margin: 8px 0 0 0; font-size: 14px;"><b>{{prod3_name}}</b><br>{{#if_show_prod3_price}}{{prod3_price}}{{/if_show_prod3_price}}</p>
                                    </td>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px;">
                                        {{#if_show_prod4_image}}<img src="{{prod4_image}}" alt="{{prod4_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 250px; height: 160px; object-fit: cover;">{{/if_show_prod4_image}}
                                        <p style="margin: 8px 0 0 0; font-size: 14px;"><b>{{prod4_name}}</b><br>{{#if_show_prod4_price}}{{prod4_price}}{{/if_show_prod4_price}}</p>
                                    </td>
                                </tr>
                            </table>{{/if_show_product_row2}}
                            {{#if_show_promo_terms}}<h3 style="font-size: 16px; font-weight: bold; margin-top: 30px;">{{promo_terms}}</h3>{{/if_show_promo_terms}}

                            {{#if_show_cta}}<div class="cta" style="text-align: center; margin: 30px 0;">
                                <a href="{{cta_link}}"
                                   style="background-color: #2E7D32; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 18px; font-weight: bold; display: inline-block;">
                                    {{cta_text}}
                                </a>
                            </div>{{/if_show_cta}}

                            <p>We wish you a very happy birthday! May you always feel loved and well cared for. 🎉</p>
                            <p style="margin-bottom: 0;">With love,<br>{{business_name}} Team</p>
                        </td>
                    </tr>
                    {{#if_show_footer}}<tr>
                        <td class="footer" style="background-color: #f4f4f4; text-align: center; font-size: 12px; color: #888; padding: 15px;">
                            &copy; 2026 {{business_name}} — All Rights Reserved
                        </td>
                    </tr>{{/if_show_footer}}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
  },
  {
    name: "🛍️ E-commerce Product & Deal Promotion",
    subject: "Your Birthday Gift is waiting! 🎁 20% Off Inside",
    customizerDefaults: {
      business_name: "Chic Boutique",
      logo_url: "https://drive.google.com/uc?export=view&id=1D3sOi4os9E47-Vd8slGIeNPXqRlzjJJO",
      promo_title: "GET 20% OFF Everything",
      coupon_code: "BDAY20OFF",
      discount_value: "20%",
      cta_text: "Shop Now & Redeem",
      cta_link: "https://example.com/shop",
      prod1_name: "Floral Summer Dress",
      prod1_price: "€49.99",
      prod1_image: "https://drive.google.com/uc?export=view&id=1h3QQmMf-hMMhwb576rePf9XjavChPrLX",
      prod2_name: "Classic Denim Jacket",
      prod2_price: "€79.99",
      prod2_image: "https://drive.google.com/uc?export=view&id=1_1_KIZ4LO1-8NXYNoBBuHZQ3Khl2nTYE",
      prod3_name: "Leather Ankle Boots",
      prod3_price: "€119.99",
      prod3_image: "https://drive.google.com/uc?export=view&id=1o239ZBFkkpfMj2MKEhl0DhNYwCTtVpmD",
      prod4_name: "Minimalist Wrist Watch",
      prod4_price: "€89.99",
      prod4_image: "https://drive.google.com/uc?export=view&id=1g8eAWTZzBH7IYdkfG31H5Fs1Nl04U90H",
      product_header_1: "🔥 Trending Products",
      product_header_2: "",
      promo_terms: "*Code expires 30 days from today. Cannot be combined with other offers.",
      show_product_header_1: "true",
      show_product_header_2: "false",
      show_product_row1: "true",
      show_product_row2: "true",
      show_prod1_price: "true",
      show_prod2_price: "true",
      show_prod3_price: "true",
      show_prod4_price: "true",
      show_coupon_box: "true",
      show_promo_terms: "true",
      show_logo: "true",
      show_promo_banner: "true",
      show_intro_text: "true",
      show_cta: "true",
      show_footer: "true",
      show_prod1_image: "true",
      show_prod2_image: "true",
      show_prod3_image: "true",
      show_prod4_image: "true",
    },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>E-commerce Promotion</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FFF5F7; color: #4A4A4A;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="padding: 30px 0;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #FFE0E6; border-collapse: collapse;">
                    {{#if_show_logo}}<tr>
                        <td align="center" class="logo" style="text-align: center; padding: 25px; background-color: #ffffff;">
                            <img src="{{logo_url}}" alt="{{business_name}} Logo" style="max-height: 70px; max-width: 100%; height: auto; display: block; margin: 0 auto;">
                        </td>
                    </tr>{{/if_show_logo}}
                    {{#if_show_promo_banner}}<tr>
                        <td style="background-color: #DB2777; padding: 35px 20px; text-align: center; color: #ffffff;">
                            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold; display: block; margin-bottom: 8px;">Special Birthday Treat</span>
                            <h1 style="margin: 0; font-size: 28px; font-weight: 800;">{{promo_title}}</h1>
                        </td>
                    </tr>{{/if_show_promo_banner}}
                    <tr>
                        <td style="padding: 30px; font-size: 15px; line-height: 1.6;">
                            <p style="margin-top: 0;">Hi <strong>{{name}}</strong>,</p>
                            {{#if_show_intro_text}}<p>It's time to treat yourself! To celebrate, we're giving you an exclusive <strong>{{discount_value}} discount</strong> across our entire store. Check out some of our current favorites selected just for you:</p>{{/if_show_intro_text}}
                            
                            {{#if_show_product_header_1}}<h3 style="margin-top: 25px; font-size: 16px; color: #DB2777; border-bottom: 2px solid #FBCFE8; padding-bottom: 8px;">{{product_header_1}}</h3>{{/if_show_product_header_1}}
                            
                            {{#if_show_product_row1}}<table class="menu-grid" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                                <tr>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px; box-sizing: border-box;">
                                        <div style="border: 1px solid #FFE0E6; border-radius: 8px; padding: 12px; background-color: #FFFDFE;">
                                            {{#if_show_prod1_image}}<img src="{{prod1_image}}" alt="{{prod1_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 220px; height: 160px; object-fit: cover;">{{/if_show_prod1_image}}
                                            <h4 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #1F2937;">{{prod1_name}}</h4>
                                            {{#if_show_prod1_price}}<span style="font-size: 13px; color: #DB2777; font-weight: bold;">{{prod1_price}}</span>{{/if_show_prod1_price}}
                                        </div>
                                    </td>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px; box-sizing: border-box;">
                                        <div style="border: 1px solid #FFE0E6; border-radius: 8px; padding: 12px; background-color: #FFFDFE;">
                                            {{#if_show_prod2_image}}<img src="{{prod2_image}}" alt="{{prod2_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 220px; height: 160px; object-fit: cover;">{{/if_show_prod2_image}}
                                            <h4 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #1F2937;">{{prod2_name}}</h4>
                                            {{#if_show_prod2_price}}<span style="font-size: 13px; color: #DB2777; font-weight: bold;">{{prod2_price}}</span>{{/if_show_prod2_price}}
                                        </div>
                                    </td>
                                </tr>
                            </table>{{/if_show_product_row1}}
                            {{#if_show_product_row2}}<table class="menu-grid" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                                <tr>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px; box-sizing: border-box;">
                                        <div style="border: 1px solid #FFE0E6; border-radius: 8px; padding: 12px; background-color: #FFFDFE;">
                                            {{#if_show_prod3_image}}<img src="{{prod3_image}}" alt="{{prod3_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 220px; height: 160px; object-fit: cover;">{{/if_show_prod3_image}}
                                            <h4 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #1F2937;">{{prod3_name}}</h4>
                                            {{#if_show_prod3_price}}<span style="font-size: 13px; color: #DB2777; font-weight: bold;">{{prod3_price}}</span>{{/if_show_prod3_price}}
                                        </div>
                                    </td>
                                    <td width="50%" align="center" style="text-align: center; vertical-align: top; padding: 10px; box-sizing: border-box;">
                                        <div style="border: 1px solid #FFE0E6; border-radius: 8px; padding: 12px; background-color: #FFFDFE;">
                                            {{#if_show_prod4_image}}<img src="{{prod4_image}}" alt="{{prod4_name}}" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto; width: 220px; height: 160px; object-fit: cover;">{{/if_show_prod4_image}}
                                            <h4 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #1F2937;">{{prod4_name}}</h4>
                                            {{#if_show_prod4_price}}<span style="font-size: 13px; color: #DB2777; font-weight: bold;">{{prod4_price}}</span>{{/if_show_prod4_price}}
                                        </div>
                                    </td>
                                </tr>
                            </table>{{/if_show_product_row2}}
                            
                            {{#if_show_coupon_box}}<div style="background-color: #FDF2F8; border: 2px dashed #DB2777; padding: 20px; text-align: center; border-radius: 8px; margin: 25px 0;">
                                <span style="font-size: 12px; text-transform: uppercase; color: #DB2777; font-weight: bold; display: block; margin-bottom: 5px;">Your Birthday Code</span>
                                <strong style="font-size: 24px; font-family: monospace; color: #BE185D; letter-spacing: 2px;">{{coupon_code}}</strong>
                            </div>{{/if_show_coupon_box}}

                            {{#if_show_cta}}<p style="text-align: center; margin: 30px 0;">
                                <a href="{{cta_link}}" style="background-color: #DB2777; color: #ffffff; padding: 14px 35px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(219,39,119,0.2);">
                                    {{cta_text}}
                                </a>
                            </p>{{/if_show_cta}}
                            
                            {{#if_show_promo_terms}}<p style="font-size: 12px; color: #888888; text-align: center; border-top: 1px solid #EEEEEE; padding-top: 20px; margin-bottom: 0;">{{promo_terms}}</p>{{/if_show_promo_terms}}
                        </td>
                    </tr>
                    {{#if_show_footer}}<tr>
                        <td class="footer" style="background-color: #FFF0F2; text-align: center; font-size: 12px; color: #DB2777; padding: 15px;">
                            &copy; 2026 {{business_name}} — All Rights Reserved
                        </td>
                    </tr>{{/if_show_footer}}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
  },
  {
    name: "💼 B2B Business Outreach",
    subject: "Improving efficiency at {{business}} - quick question",
    customizerDefaults: {
      business_name: "Apex Solutions",
      logo_url: "https://drive.google.com/uc?export=view&id=1D3sOi4os9E47-Vd8slGIeNPXqRlzjJJO",
      promo_title: "Scale Your Business Automation Today",
      coupon_code: "N/A",
      discount_value: "N/A",
      cta_text: "Book a Brief Call",
      cta_link: "https://calendly.com",
      prod1_name: "Custom CRM Audit",
      prod1_price: "Free Consultation",
      prod1_image: "https://drive.google.com/uc?export=view&id=1h3QQmMf-hMMhwb576rePf9XjavChPrLX",
      prod2_name: "Email Deliverability Check",
      prod2_price: "Included",
      prod2_image: "https://drive.google.com/uc?export=view&id=1_1_KIZ4LO1-8NXYNoBBuHZQ3Khl2nTYE",
      prod3_name: "Automated Outreach Setup",
      prod3_price: "€499 / mo",
      prod3_image: "https://drive.google.com/uc?export=view&id=1o239ZBFkkpfMj2MKEhl0DhNYwCTtVpmD",
      prod4_name: "AI Agent Integration",
      prod4_price: "€999 / mo",
      prod4_image: "https://drive.google.com/uc?export=view&id=1g8eAWTZzBH7IYdkfG31H5Fs1Nl04U90H",
      product_header_1: "Our Core Services:",
      product_header_2: "",
      promo_terms: "",
      show_product_header_1: "true",
      show_product_header_2: "false",
      show_product_row1: "true",
      show_product_row2: "true",
      show_prod1_price: "true",
      show_prod2_price: "true",
      show_prod3_price: "true",
      show_prod4_price: "true",
      show_coupon_box: "false",
      show_promo_terms: "false",
      show_logo: "true",
      show_promo_banner: "true",
      show_intro_text: "true",
      show_cta: "true",
      show_footer: "true",
      show_prod1_image: "true",
      show_prod2_image: "true",
      show_prod3_image: "true",
      show_prod4_image: "true",
    },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Business Outreach</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="padding: 40px 10px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #E2E8F0; border-collapse: collapse;">
                    {{#if_show_logo}}<tr>
                        <td align="center" style="background-color: #0F172A; padding: 30px; text-align: center;">
                            <img src="{{logo_url}}" alt="{{business_name}} Logo" style="max-height: 50px; max-width: 100%; height: auto; display: block; margin: 0 auto; filter: brightness(0) invert(1);">
                        </td>
                    </tr>{{/if_show_logo}}
                    <tr>
                        <td style="padding: 40px 30px; font-size: 16px; line-height: 1.6;">
                            <p style="margin-top: 0;">Hi {{name}},</p>
                            {{#if_show_intro_text}}<p>I noticed your business, <strong>{{business}}</strong>, while researching top organizations in your field.</p>
                            <p>At <strong>{{business_name}}</strong>, we specialize in helping businesses scale by automating key administrative workflows and marketing loops. Here are a few ways we work with our partners to drive growth:</p>{{/if_show_intro_text}}
                            
                            {{#if_show_product_header_1}}<h3 style="margin-top: 30px; font-size: 15px; color: #0F172A; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">{{product_header_1}}</h3>{{/if_show_product_header_1}}
                            {{#if_show_product_row1}}<table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                                <tr>
                                    <td width="50%" style="padding: 10px; vertical-align: top;">
                                        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; background-color: #F8FAFC; min-height: 120px;">
                                            <h4 style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #0F172A;">{{prod1_name}}</h4>
                                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">Audit your current customer lifecycle and touchpoints.</p>
                                            {{#if_show_prod1_price}}<strong style="font-size: 13px; color: #2563EB;">{{prod1_price}}</strong>{{/if_show_prod1_price}}
                                        </div>
                                    </td>
                                    <td width="50%" style="padding: 10px; vertical-align: top;">
                                        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; background-color: #F8FAFC; min-height: 120px;">
                                            <h4 style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #0F172A;">{{prod2_name}}</h4>
                                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">Validate Domain reputation, SPF, DKIM, and DMARC settings.</p>
                                            {{#if_show_prod2_price}}<strong style="font-size: 13px; color: #2563EB;">{{prod2_price}}</strong>{{/if_show_prod2_price}}
                                        </div>
                                    </td>
                                </tr>
                            </table>{{/if_show_product_row1}}
                            {{#if_show_product_row2}}<table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                                <tr>
                                    <td width="50%" style="padding: 10px; vertical-align: top;">
                                        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; background-color: #F8FAFC; min-height: 120px;">
                                            <h4 style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #0F172A;">{{prod3_name}}</h4>
                                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">Deploy and run cold outreach lists and sequences.</p>
                                            {{#if_show_prod3_price}}<strong style="font-size: 13px; color: #2563EB;">{{prod3_price}}</strong>{{/if_show_prod3_price}}
                                        </div>
                                    </td>
                                    <td width="50%" style="padding: 10px; vertical-align: top;">
                                        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; background-color: #F8FAFC; min-height: 120px;">
                                            <h4 style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #0F172A;">{{prod4_name}}</h4>
                                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">Integrate OpenAI, Claude, or Gemini into your product flow.</p>
                                            {{#if_show_prod4_price}}<strong style="font-size: 13px; color: #2563EB;">{{prod4_price}}</strong>{{/if_show_prod4_price}}
                                        </div>
                                    </td>
                                </tr>
                            </table>{{/if_show_product_row2}}
                            
                            {{#if_show_cta}}<div style="text-align: center; margin: 35px 0;">
                                <a href="{{cta_link}}" style="background-color: #2563EB; color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                                    {{cta_text}}
                                </a>
                            </div>{{/if_show_cta}}
                            
                            <p>Would you be open to a brief introductory conversation next week?</p>
                            
                            <p style="margin-bottom: 0; border-top: 1px solid #F1F5F9; padding-top: 25px; font-size: 14px; color: #64748B;">
                                Best regards,<br>
                                The <strong>{{business_name}}</strong> Team
                            </p>
                        </td>
                    </tr>
                    {{#if_show_footer}}<tr>
                        <td style="background-color: #0F172A; text-align: center; font-size: 12px; color: #94A3B8; padding: 20px;">
                            &copy; 2026 {{business_name}} — All Rights Reserved
                        </td>
                    </tr>{{/if_show_footer}}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
  }
];

function compileHtmlTemplate(baseHtml: string, values: Record<string, string>) {
  let result = baseHtml;
  // First pass: resolve conditional show/hide blocks  {{#if_show_KEY}}...{{/if_show_KEY}}
  result = result.replace(/\{\{#if_show_(\w+)\}\}([\s\S]*?)\{\{\/if_show_\1\}\}/g, (_match, key, content) => {
    return values[`show_${key}`] === "false" ? "" : content;
  });
  // Second pass: replace all {{key}} placeholders
  Object.entries(values).forEach(([key, val]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, val || "");
  });
  return result;
}

function InlineImageUploader({
  value,
  onChange,
  label,
  placeholder,
  toast,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  placeholder?: string;
  toast: any;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background border-border text-foreground h-9 font-mono text-xs flex-1"
          placeholder={placeholder || "https://example.com/image.png"}
        />
        <label className="flex items-center justify-center bg-primary hover:bg-primary/95 text-white text-xs font-semibold px-3 rounded-lg cursor-pointer transition-all shrink-0 h-9">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "📁 Upload"
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64Content = reader.result as string;
                try {
                  toast({ title: `Uploading ${label}...` });
                  const data = await api.post<{ url: string }>("/settings/upload-image", {
                    name: file.name,
                    content: base64Content,
                  });
                  onChange(data.url);
                  toast({
                    title: "Upload Successful",
                    description: `${label} image hosted and injected.`,
                  });
                } catch (err) {
                  toast({
                    title: "Upload Failed",
                    description: `Failed to host image: ${err instanceof Error ? err.message : "server error"}`,
                    variant: "destructive",
                  });
                } finally {
                  setUploading(false);
                }
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}

export default function MessagePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscriptionPlan } = useAuth();
  const isBasePlan = subscriptionPlan === "base";
  const [pageSize, setPageSize] = useState<(typeof batchSizes)[number]>("25");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [personalMailboxes, setPersonalMailboxes] = useState<any[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [pitch, setPitch] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [campaignType, setCampaignType] = useState<"ai" | "manual" | "automated">("manual");

  useEffect(() => {
    if (subscriptionPlan && subscriptionPlan !== "base") {
      setCampaignType("ai");
    } else {
      setCampaignType("manual");
    }
  }, [subscriptionPlan]);

  const [editorMode, setEditorMode] = useState<"form" | "code">("form");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [baseHtmlTemplate, setBaseHtmlTemplate] = useState<string>("");
  const [customizerValues, setCustomizerValues] = useState<Record<string, string>>({
    business_name: "",
    logo_url: "",
    promo_title: "",
    coupon_code: "",
    discount_value: "",
    cta_text: "",
    cta_link: "",
    prod1_name: "", prod1_price: "", prod1_image: "",
    prod2_name: "", prod2_price: "", prod2_image: "",
    prod3_name: "", prod3_price: "", prod3_image: "",
    prod4_name: "", prod4_price: "", prod4_image: "",
    product_header_1: "", product_header_2: "", promo_terms: "",
    // Section visibility defaults — all visible by default
    show_logo: "true", show_promo_banner: "true", show_intro_text: "true",
    show_product_header_1: "true", show_product_header_2: "true",
    show_product_row1: "true", show_product_row2: "true",
    show_prod1_price: "true", show_prod1_image: "true",
    show_prod2_price: "true", show_prod2_image: "true",
    show_prod3_price: "true", show_prod3_image: "true",
    show_prod4_price: "true", show_prod4_image: "true",
    show_coupon_box: "true", show_promo_terms: "true",
    show_cta: "true", show_footer: "true",
  });

  // Direct memoized compilation: anytime customizerValues OR baseHtmlTemplate changes,
  // the compiled body is immediately available — no async state update needed.
  const compiledHtmlBody = useMemo(() => {
    if (!baseHtmlTemplate || editorMode !== "form") return null;
    return compileHtmlTemplate(baseHtmlTemplate, customizerValues);
  }, [customizerValues, baseHtmlTemplate, editorMode]);

  // Keep bodyTemplate in sync for the launch payload (code-mode edits come through bodyTemplate directly)
  useEffect(() => {
    if (compiledHtmlBody !== null) {
      setBodyTemplate(compiledHtmlBody);
    }
  }, [compiledHtmlBody]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedLeadsDetails, setSelectedLeadsDetails] = useState<Lead[]>([]);
  const [loadingSelectedLeads, setLoadingSelectedLeads] = useState(false);
  const [triggerRule, setTriggerRule] = useState<{
    dateFieldKey: string;
    daysOffset: number;
    timingType: "before" | "on" | "after";
  }>({
    dateFieldKey: "",
    daysOffset: 30,
    timingType: "before",
  });
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const totalDailyCapacity = useMemo(() => {
    const activeMailboxes = personalMailboxes.filter((m) => m.isActive !== false);
    if (activeMailboxes.length === 0) {
      return 50; // Fallback to shared system mailbox capacity
    }
    return activeMailboxes.reduce((sum, m) => sum + (m.dailySendLimit ?? 50), 0);
  }, [personalMailboxes]);

  const fetchMailboxes = async () => {
    try {
      const data = await api.get<{ items: any[] }>("/settings/email-accounts");
      setPersonalMailboxes(data.items ?? []);
    } catch (err) {
      console.warn("Failed to load personal mailboxes, using default capacity.", err);
      setPersonalMailboxes([]);
    }
  };

  useEffect(() => {
    void fetchMailboxes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // State for imported campaigns list
  const [importedCampaigns, setImportedCampaigns] = useState<any[]>([]);
  const [loadingImportedCampaigns, setLoadingImportedCampaigns] = useState(false);
  const [filterCampaignId, setFilterCampaignId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("crm");
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [loadingMultiLeads, setLoadingMultiLeads] = useState(false);

  const handleTargetSelectedCampaigns = async (proceedToStep3: boolean) => {
    setLoadingMultiLeads(true);
    try {
      const allLeads: string[] = [];
      for (const campId of selectedCampaignIds) {
        const data = await api.get<{ ids: string[] }>(`/leads/campaigns/${campId}/ids`);
        (data.ids ?? []).forEach((id) => {
          if (!allLeads.includes(id)) {
            allLeads.push(id);
          }
        });
      }
      setSelectedLeadIds(allLeads);
      toast({
        title: "Lists Loaded",
        description: `Successfully loaded ${allLeads.length} contacts from the selected sheets.`,
      });
      if (proceedToStep3) {
        setStep(3);
      } else {
        setFilterCampaignId("all");
        setActiveTab("crm");
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load contacts from selected sheets.",
        variant: "destructive",
      });
    } finally {
      setLoadingMultiLeads(false);
    }
  };

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadImportedCampaigns = async () => {
    setLoadingImportedCampaigns(true);
    try {
      const data = await api.get<{ items: any[] }>("/leads/campaigns/list");
      setImportedCampaigns((data.items ?? []).filter((c) => c.source === "custom"));
    } catch (err) {
      console.error("Failed to load imported campaigns", err);
    } finally {
      setLoadingImportedCampaigns(false);
    }
  };

  const targetEntireList = async (campaignId: string, campaignName: string) => {
    setLoadingLeads(true);
    try {
      const data = await api.get<{ items: Lead[] }>(`/leads?campaignId=${campaignId}&pageSize=500`);
      const ids = (data.items ?? []).map((l) => l.id);
      setSelectedLeadIds(ids);
      toast({
        title: "List Targeted",
        description: `Successfully targeted all ${ids.length} contacts from list "${campaignName}".`,
      });
      setStep(3);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load leads from the selected list.",
        variant: "destructive",
      });
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadAndAutoSelectInCRM = async (campaignId: string, campaignName: string) => {
    setLoadingLeads(true);
    try {
      const data = await api.get<{ items: Lead[] }>(`/leads?campaignId=${campaignId}&pageSize=500`);
      const ids = (data.items ?? []).map((l) => l.id);
      setSelectedLeadIds(ids);
      setFilterCampaignId(campaignId);
      setActiveTab("crm");
      toast({
        title: "List Selected",
        description: `Loaded and checked all ${ids.length} contacts from list "${campaignName}" in the CRM table.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load leads from the selected list.",
        variant: "destructive",
      });
    } finally {
      setLoadingLeads(false);
    }
  };

  const allAvailableCustomFields = useMemo(() => {
    const fields = new Set<string>();
    leads.forEach((lead) => {
      if (lead.metadata && typeof lead.metadata === "object") {
        Object.keys(lead.metadata).forEach((key) => {
          fields.add(key);
        });
      }
    });
    return Array.from(fields);
  }, [leads]);

  const customFields = useMemo(() => {
    const fields = new Set<string>();
    selectedLeadsDetails.forEach((lead) => {
      if (lead.metadata && typeof lead.metadata === "object") {
        Object.keys(lead.metadata).forEach((key) => {
          fields.add(key);
        });
      }
    });
    return Array.from(fields);
  }, [selectedLeadsDetails]);

  const insertTag = (tag: string) => {
    const subjectEl = subjectRef.current;
    const bodyEl = bodyRef.current;

    if (document.activeElement === subjectEl && subjectEl) {
      const start = subjectEl.selectionStart ?? 0;
      const end = subjectEl.selectionEnd ?? 0;
      const text = subjectEl.value;
      const updated = text.substring(0, start) + tag + text.substring(end);
      setSubjectTemplate(updated);
      setTimeout(() => {
        subjectEl.focus();
        subjectEl.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else if (document.activeElement === bodyEl && bodyEl) {
      const start = bodyEl.selectionStart ?? 0;
      const end = bodyEl.selectionEnd ?? 0;
      const text = bodyEl.value;
      const updated = text.substring(0, start) + tag + text.substring(end);
      setBodyTemplate(updated);
      setTimeout(() => {
        bodyEl.focus();
        bodyEl.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setBodyTemplate((prev) => prev + tag);
    }
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams({
        pageSize,
        page: page.toString(),
      });
      if (filterCampaignId && filterCampaignId !== "all") {
        params.append("campaignId", filterCampaignId);
      }
      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }
      const data = await api.get<{ items: Lead[]; total?: number }>(`/leads?${params.toString()}`);
      setLeads(data.items ?? []);
      setTotalLeadsCount(data.total ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load leads";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoadingLeads(false);
    }
  };

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setPage(1);
  }, [pageSize, filterCampaignId, debouncedSearch]);

  useEffect(() => {
    void fetchLeads();
  }, [page, pageSize, filterCampaignId, debouncedSearch]);

  useEffect(() => {
    setSelectedLeadIds([]);
  }, [filterCampaignId]);

  useEffect(() => {
    void loadImportedCampaigns();
  }, []);

  useEffect(() => {
    if (step === 3 && selectedLeadIds.length > 0) {
      const fetchSelectedLeadsDetails = async () => {
        setLoadingSelectedLeads(true);
        try {
          const params = new URLSearchParams({
            ids: selectedLeadIds.slice(0, 20).join(","),
            pageSize: "20",
          });
          const data = await api.get<{ items: Lead[] }>(`/leads?${params.toString()}`);
          setSelectedLeadsDetails(data.items ?? []);
        } catch (err) {
          console.error("Failed to load selected lead details", err);
          toast({
            title: "Warning",
            description: "Failed to load custom columns for selected leads.",
            variant: "destructive",
          });
        } finally {
          setLoadingSelectedLeads(false);
        }
      };
      void fetchSelectedLeadsDetails();
    } else if (selectedLeadIds.length === 0) {
      setSelectedLeadsDetails([]);
    }
  }, [step, selectedLeadIds]);

  const visibleLeads = useMemo(() => {
    return leads
      .filter((lead) => Boolean(lead.email))
      .filter((lead) => {
        if (!search.trim()) return true;
        const query = search.trim().toLowerCase();
        return (
          lead.name.toLowerCase().includes(query) ||
          lead.business.toLowerCase().includes(query) ||
          (lead.email || "").toLowerCase().includes(query) ||
          (lead.location || "").toLowerCase().includes(query)
        );
      });
  }, [leads, search]);

  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      if (prev.includes(leadId)) {
        return prev.filter((id) => id !== leadId);
      }
      return [...prev, leadId];
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visibleLeads.map((lead) => lead.id);
    const allVisibleSelected = visibleIds.every((id) => selectedLeadIds.includes(id));

    if (allVisibleSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    const next = [...selectedLeadIds];
    for (const id of visibleIds) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    setSelectedLeadIds(next);
  };

  const createCampaign = async () => {
    const trimmedPitch = pitch.trim();
    if (selectedLeadIds.length === 0) {
      toast({ title: "No leads selected", description: "Select at least one lead with an email address.", variant: "destructive" });
      return;
    }

    if (campaignType === "manual" || campaignType === "automated") {
      if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
        toast({
          title: "Validation Error",
          description: "Email subject and message are required for your campaign.",
          variant: "destructive",
        });
        return;
      }
      if (campaignType === "automated" && !triggerRule.dateFieldKey) {
        toast({
          title: "Validation Error",
          description: "Please select which date field triggers this campaign.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (trimmedPitch.length < 20) {
        toast({ title: "Campaign brief is too short", description: "Add a meaningful description of your product or service.", variant: "destructive" });
        return;
      }
    }

    setCreatingCampaign(true);
    try {
      await api.post("/leads/message-campaigns", {
        leadIds: selectedLeadIds,
        campaignType,
        pitch: campaignType === "ai" ? trimmedPitch : "",
        subjectTemplate: campaignType !== "ai" ? subjectTemplate.trim() : "",
        bodyTemplate: campaignType !== "ai" ? bodyTemplate.trim() : "",
        triggerRule: campaignType === "automated" ? triggerRule : undefined,
        scheduledAt: (campaignType === "ai" || campaignType === "manual") && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      toast({ title: "Automation campaign started" });
      setPitch("");
      setSubjectTemplate("");
      setBodyTemplate("");
      setScheduledAt("");
      setSelectedLeadIds([]);
      setStep(1);
      await fetchLeads();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start automation campaign";
      toast({ title: "Campaign failed", description: message, variant: "destructive" });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const getDeliveryTimeEstimate = (count: number, type: "ai" | "manual" | "automated") => {
    if (type === "automated") {
      return "Sends dynamically daily based on event rules";
    }
    if (count === 0) return "0 seconds";

    const dailyCapacity = totalDailyCapacity;

    if (count <= dailyCapacity) {
      const totalSeconds = count * 7.5;
      if (totalSeconds < 60) {
        return `~${Math.round(totalSeconds)} seconds`;
      }
      const totalMinutes = Math.floor(totalSeconds / 60);
      const seconds = Math.round(totalSeconds % 60);

      if (totalMinutes < 60) {
        return `~${totalMinutes}m ${seconds > 0 ? seconds + "s" : ""}`.trim();
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `~${hours}h ${minutes}m ${seconds > 0 ? seconds + "s" : ""}`.trim();
    } else {
      const days = Math.floor(count / dailyCapacity);
      const remainingCount = count % dailyCapacity;

      const lastDaySeconds = remainingCount * 7.5;
      const lastDayMinutes = Math.floor(lastDaySeconds / 60);
      const lastDaySecs = Math.round(lastDaySeconds % 60);
      const lastDayHours = Math.floor(lastDayMinutes / 60);
      const lastDayMins = lastDayMinutes % 60;

      let parts = [];
      parts.push(`~${days} day${days > 1 ? "s" : ""}`);
      if (lastDayHours > 0) parts.push(`${lastDayHours}h`);
      if (lastDayMins > 0) parts.push(`${lastDayMins}m`);
      if (lastDaySecs > 0 && lastDayHours === 0) parts.push(`${lastDaySecs}s`);

      return `${parts.join(" ")} (distributed over daily limits)`;
    }
  };

  const generateCampaignBrief = async () => {
    setGeneratingPitch(true);
    try {
      const data = await api.post<{ brief: string }>("/leads/message-campaigns/brief", {
        leadIds: selectedLeadIds.slice(0, 50),
        description: pitch,
      });

      setPitch(data.brief || "");
      toast({
        title: "Campaign brief generated",
        description: "The AI used your brand profile and selected leads to draft the brief.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate campaign brief";
      toast({
        title: "Brief generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGeneratingPitch(false);
    }
  };

  const ruleSentence = useMemo(() => {
    const fieldText = triggerRule.dateFieldKey ? `'${triggerRule.dateFieldKey}'` : "[Select date field]";
    if (triggerRule.timingType === "on" || triggerRule.daysOffset === 0) {
      return `Emails will be sent on the ${fieldText} date stored in each lead's details.`;
    }
    const offsetText = `${triggerRule.daysOffset} day${triggerRule.daysOffset === 1 ? "" : "s"} `;
    return `Emails will be sent ${offsetText}${triggerRule.timingType} the ${fieldText} date stored in each lead's details.`;
  }, [triggerRule]);

  const renderTemplate = (template: string, lead?: Lead) => {
    if (!lead) return template;
    let result = template;

    result = result.replace(/\{\{name\}\}/g, lead.name || "");
    result = result.replace(/\{\{business\}\}/g, lead.business || "");
    result = result.replace(/\{\{location\}\}/g, lead.location || "");
    result = result.replace(/\{\{email\}\}/g, lead.email || "");
    result = result.replace(/\{\{phone\}\}/g, (lead as any).phone || "");
    result = result.replace(/\{\{website\}\}/g, (lead as any).website || "");
    result = result.replace(/\{\{industry\}\}/g, (lead as any).industry || "");

    if (lead.metadata && typeof lead.metadata === "object") {
      for (const [key, value] of Object.entries(lead.metadata)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        result = result.replace(regex, String(value ?? ""));
      }
    }

    return result;
  };

  const sampleLead = useMemo(() => {
    if (selectedLeadIds.length === 0) return undefined;
    if (selectedLeadsDetails.length > 0) return selectedLeadsDetails[0];
    const found = leads.find((l) => selectedLeadIds.includes(l.id));
    if (found) return found;
    return leads[0];
  }, [leads, selectedLeadIds, selectedLeadsDetails]);

  const handleStep1Next = () => {
    setStep(2);
  };

  const steps = [
    { id: 1, name: "Campaign Type", description: "Choose outreach mode" },
    { id: 2, name: "Choose Audience", description: "Select target leads" },
    { id: 3, name: "Setup & Preview", description: "Write templates & triggers" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Outreach Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Launch customized email campaigns, set dynamic date triggers, or use AI to personalize your outreach.
          </p>
        </div>

        {/* Wizard Stepper */}
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => {
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(255,102,0,0.3)]"
                          : isCompleted
                          ? "border-primary/60 bg-primary/5 text-primary shadow-[0_0_10px_rgba(255,102,0,0.15)]"
                          : "border-border bg-background/50 text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? "✓" : s.id}
                    </div>
                    <div className="hidden md:block">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${isActive ? "text-primary font-bold" : isCompleted ? "text-primary/80" : "text-muted-foreground"}`}>
                        {s.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 mx-4 h-[2px] bg-border relative rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-orange-400 shadow-[0_0_8px_rgba(255,102,0,0.4)] transition-all duration-500"
                        style={{ width: isCompleted ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Choose Campaign Type */}
        {step === 1 ? (
          <div className="glass-panel p-8 space-y-6 animate-in fade-in duration-300">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary font-bold">Step 1</p>
              <h2 className="text-lg font-bold text-foreground">What kind of campaign would you like to run?</h2>
              <p className="text-sm text-muted-foreground">
                Select your outreach mode. You will choose your audience and set up email details in the next steps.
              </p>
            </div>

            {/* Campaign Type Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
              <button
                type="button"
                onClick={() => {
                  if (isBasePlan) {
                    toast({
                      title: "Upgrade Required",
                      description: "AI Outreach is only available on the AI Lead Gen plan. Please upgrade to unlock.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setCampaignType("ai");
                }}
                className={`flex flex-col text-left p-5 rounded-xl border-2 transition-all duration-250 relative ${
                  isBasePlan
                    ? "border-border/50 bg-background/30 opacity-70 cursor-not-allowed"
                    : campaignType === "ai"
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(255,102,0,0.1)] scale-[1.01]"
                    : "border-border hover:border-primary/20 bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isBasePlan ? "bg-muted text-muted-foreground" : campaignType === "ai" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-foreground text-sm">AI Outreach</span>
                  </div>
                  {isBasePlan && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 flex items-center">
                      <Lock className="h-3 w-3" /> Upgrade
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Provide a brief, and our AI uses your company profile to write unique, custom-tailored emails for each recipient.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCampaignType("manual")}
                className={`flex flex-col text-left p-5 rounded-xl border-2 transition-all duration-250 ${
                  campaignType === "manual"
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(255,102,0,0.1)] scale-[1.01]"
                    : "border-border hover:border-primary/20 bg-background/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${campaignType === "manual" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Custom Campaign</span>
                </div>
                <span className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Write your own email template and subject. Personalize it with automatically replaced contact details.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCampaignType("automated")}
                className={`flex flex-col text-left p-5 rounded-xl border-2 transition-all duration-250 ${
                  campaignType === "automated"
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(255,102,0,0.1)] scale-[1.01]"
                    : "border-border hover:border-primary/20 bg-background/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${campaignType === "automated" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Automated Event</span>
                </div>
                <span className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Send emails automatically relative to dates in your list (like birthdays, signups, or renewal dates).
                </span>
              </button>
            </div>

            {/* Layman explainer card specifically for Automated Event */}
            {campaignType === "automated" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  How Automated Event Campaigns Work
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instead of sending to everyone immediately, this campaign runs constantly in the background. It checks your recipient list every day and sends this email only when a lead matches your scheduled date rule.
                </p>
                
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-foreground">Popular Examples:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-background/60 border border-border p-3 rounded-lg">
                      <span className="font-medium text-xs text-primary">🎂 Birthday Coupons</span>
                      <p className="text-[10px] text-muted-foreground mt-1">Send a discount code exactly <strong>7 days before</strong> their Birthday.</p>
                    </div>
                    <div className="bg-background/60 border border-border p-3 rounded-lg">
                      <span className="font-medium text-xs text-primary">🔄 Renewal Alerts</span>
                      <p className="text-[10px] text-muted-foreground mt-1">Send a reminder invoice exactly <strong>15 days before</strong> their Subscription Ends.</p>
                    </div>
                    <div className="bg-background/60 border border-border p-3 rounded-lg">
                      <span className="font-medium text-xs text-primary">👋 Onboarding Emails</span>
                      <p className="text-[10px] text-muted-foreground mt-1">Send a check-in message exactly <strong>30 days after</strong> their Signup Date.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={handleStep1Next} className="min-w-40 gap-2 bg-primary hover:bg-primary/95 text-white font-medium shadow-[0_4px_16px_rgba(255,102,0,0.2)]">
                Continue to Audience <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 2: Choose Audience */}
        {step === 2 ? (
          <div className="glass-panel p-8 space-y-6 animate-in fade-in duration-300">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary font-bold">Step 2</p>
              <h2 className="text-lg font-bold text-foreground">Choose Target Audience</h2>
              <p className="text-sm text-muted-foreground">
                Select your target leads from the CRM list, or import a spreadsheet containing your contacts.
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto mb-6 bg-muted/40 p-1 border border-border rounded-xl">
                <TabsTrigger value="crm" className="rounded-lg py-2 text-sm font-semibold transition-all">
                  CRM Contacts
                </TabsTrigger>
                <TabsTrigger value="imported_lists" className="rounded-lg py-2 text-sm font-semibold transition-all">
                  Imported Lists
                </TabsTrigger>
                <TabsTrigger value="import" className="rounded-lg py-2 text-sm font-semibold transition-all">
                  Upload Spreadsheet
                </TabsTrigger>
              </TabsList>

              <TabsContent value="crm" className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Select Leads from CRM</h3>
                    <p className="text-xs text-muted-foreground">
                      Pick up to 500 leads with email addresses for this campaign.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="w-48">
                      <Select value={filterCampaignId} onValueChange={setFilterCampaignId}>
                        <SelectTrigger className="h-9 bg-background/50 border-border">
                          <SelectValue placeholder="Filter by List..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Contacts</SelectItem>
                          {importedCampaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.businessType} ({c.leadCount})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="Search leads..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full lg:w-56 h-9"
                    />
                    <Select value={pageSize} onValueChange={(value) => setPageSize(value as (typeof batchSizes)[number])}>
                      <SelectTrigger className="w-24 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {batchSizes.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void fetchLeads()} disabled={loadingLeads}>
                      <RefreshCw className={`h-4 w-4 ${loadingLeads ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                  <span>{visibleLeads.length} eligible leads loaded</span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded border border-primary/20">
                      {selectedLeadIds.length} selected
                    </span>
                    <Button variant="outline" size="sm" onClick={toggleSelectAllVisible}>
                      Select Visible
                    </Button>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-auto rounded-2xl border border-border/80 bg-background/40 backdrop-blur-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 border-b border-border bg-muted/65 backdrop-blur z-10">
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Pick</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Business</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Source List</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Email</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Location</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingLeads ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span>Loading leads...</span>
                            </div>
                          </td>
                        </tr>
                      ) : visibleLeads.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                            No eligible leads found.
                          </td>
                        </tr>
                      ) : (
                        visibleLeads.map((lead) => {
                          const checked = selectedLeadIds.includes(lead.id);

                          return (
                            <tr key={lead.id} className="border-b border-border/60 hover:bg-primary/5">
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleLead(lead.id)}
                                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div>
                                  <p className="font-medium text-foreground">{lead.business}</p>
                                  <p className="text-xs text-muted-foreground">{lead.name}</p>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-muted-foreground font-medium text-xs">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 max-w-[150px] truncate">
                                  {lead.campaign?.businessType || "Direct Import"}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">{lead.email}</td>
                              <td className="px-3 py-3 text-muted-foreground">{lead.location || "-"}</td>
                              <td className="px-3 py-3">
                                {lead.emailStatus?.sent ? (
                                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                    Sent{lead.emailStatus.sentCount > 1 ? ` (${lead.emailStatus.sentCount})` : ""}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Not Sent</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border border-border/60 px-4 py-3 bg-background/30 rounded-2xl">
                  <div className="text-xs text-muted-foreground">
                    Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
                    <span className="font-semibold text-foreground">{Math.ceil(totalLeadsCount / Number(pageSize)) || 1}</span>
                    {" "}(<span className="font-semibold text-foreground">{totalLeadsCount}</span> total leads)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loadingLeads}
                      className="h-8 text-xs gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(Math.ceil(totalLeadsCount / Number(pageSize)), p + 1))}
                      disabled={page >= Math.ceil(totalLeadsCount / Number(pageSize)) || loadingLeads}
                      className="h-8 text-xs gap-1.5"
                    >
                      Next <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="imported_lists" className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Select from Saved Spreadsheet Lists</h3>
                    <p className="text-xs text-muted-foreground">
                      Choose a previously uploaded file to target all contacts in it or auto-select them in the CRM.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 hover:text-primary hover:bg-primary/5" onClick={() => void loadImportedCampaigns()} disabled={loadingImportedCampaigns}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loadingImportedCampaigns ? "animate-spin" : ""}`} />
                    Refresh Lists
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {loadingImportedCampaigns ? (
                    <div className="col-span-full py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading imported lists...
                    </div>
                  ) : importedCampaigns.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                      No saved spreadsheet lists found. Go to the "Upload Spreadsheet" tab to import your first file.
                    </div>
                  ) : (
                    importedCampaigns.map((camp) => {
                      const isSelected = selectedCampaignIds.includes(camp.id);
                      return (
                        <div
                          key={camp.id}
                          onClick={() => {
                            setSelectedCampaignIds((prev) =>
                              prev.includes(camp.id) ? prev.filter((id) => id !== camp.id) : [...prev, camp.id]
                            );
                          }}
                          className={`rounded-xl border p-5 space-y-4 transition-all flex flex-col justify-between cursor-pointer select-none relative ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(255,102,0,0.15)]"
                              : "border-border bg-background/40 hover:bg-background/80 hover:border-primary/20"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-foreground text-sm line-clamp-1 flex items-center gap-2">
                                <span className="text-primary">📄</span> {camp.businessType}
                              </h4>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by onClick
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0"
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{camp.leadCount} contacts</span>
                              <span>{camp.location}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Imported: {new Date(camp.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedCampaignIds.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <p className="text-sm font-semibold text-foreground">
                        Selected {selectedCampaignIds.length} list{selectedCampaignIds.length > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total targeted contacts: {
                          selectedCampaignIds.reduce((acc, id) => {
                            const found = importedCampaigns.find((c) => c.id === id);
                            return acc + (found?.leadCount || 0);
                          }, 0)
                        }
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingMultiLeads}
                        onClick={() => void handleTargetSelectedCampaigns(false)}
                        className="text-xs h-9"
                      >
                        {loadingMultiLeads ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Review & Exclude Contacts
                      </Button>
                      <Button
                        size="sm"
                        disabled={loadingMultiLeads}
                        onClick={() => void handleTargetSelectedCampaigns(true)}
                        className="text-xs h-9 bg-primary hover:bg-primary/95 text-white font-medium shadow-[0_0_10px_rgba(255,102,0,0.2)]"
                      >
                        {loadingMultiLeads ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Target Selected Lists
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="import" className="space-y-4">
                <div className="border border-border/60 rounded-2xl bg-muted/5 p-1">
                  <LeadImportWorkspace
                    onImportSuccess={async (importedIds) => {
                      if (importedIds.length > 0) {
                        setSelectedLeadIds(importedIds);
                        await fetchLeads();
                        toast({
                          title: "Audience imported successfully",
                          description: `Automatically selected the ${importedIds.length} newly imported leads. Ready for campaign setup!`,
                        });
                        setStep(3);
                      }
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Type
              </Button>
              <Button
                onClick={() => {
                  if (selectedLeadIds.length === 0) {
                    toast({
                      title: "No leads selected",
                      description: "Please select at least one recipient lead (or upload a spreadsheet) to continue.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setStep(3);
                }}
                className="min-w-40 gap-2 bg-primary hover:bg-primary/95 text-white font-medium shadow-[0_4px_16px_rgba(255,102,0,0.2)]"
              >
                Setup Campaign Content <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 3: Campaign Setup & Preview */}
        {step === 3 ? (
          <div className="glass-panel p-8 space-y-6 animate-in fade-in duration-300">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary font-bold">Step 3</p>
              <h2 className="text-lg font-bold text-foreground">Configure Campaign Setup</h2>
              <p className="text-sm text-muted-foreground">
                Set up email subject, body, or automated rules. Check previews in real-time.
              </p>
            </div>

            {/* Step 3 Header Summary Panel */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              {/* Left: Summary Metrics */}
              <div className="flex-1 glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Audience</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-foreground">{selectedLeadIds.length}</span>
                      <span className="text-xs text-muted-foreground">contacts eligible for campaign</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:border-l md:border-border/40 md:pl-6">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery Estimate</p>
                    <p className="text-sm font-extrabold text-primary">
                      {getDeliveryTimeEstimate(selectedLeadIds.length, campaignType)}
                    </p>
                    {campaignType !== "automated" && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Paced at 7.5s per email to protect mailbox deliverability reputation.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Multi-Day warning banner, if applicable */}
              {selectedLeadIds.length > totalDailyCapacity && campaignType !== "automated" && (
                <div className="md:w-96 flex flex-col justify-between border border-primary/30 bg-primary/5 p-4 rounded-xl space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-start gap-2.5">
                    <span className="text-primary text-sm mt-0.5 font-bold">⚠️</span>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-primary">Multi-Day Campaign Distribution</p>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Audience of <strong>{selectedLeadIds.length}</strong> exceeds your daily limit of <strong>{totalDailyCapacity}</strong>.
                        Divided over <strong>{Math.ceil(selectedLeadIds.length / totalDailyCapacity)} days</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-primary/10 flex justify-between items-center gap-2">
                    <span className="text-[9px] text-muted-foreground leading-snug">
                      Want to send faster? Add more SMTP accounts to increase capacity.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/email-settings")}
                      className="text-[9px] font-bold h-6 shrink-0 border-primary/20 text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 px-2 rounded"
                    >
                      ⚡ Add Accounts
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left Column (Span 1): Configuration Forms */}
              <div className="space-y-6">
                
                {/* Trigger Configuration (Layman Inline sentence builder) */}
                {campaignType === "automated" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Campaign Trigger Logic</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        💡 Build when emails should send relative to dates. We check this column in your selected contacts.
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-y-3 gap-x-2 text-sm text-foreground bg-background/50 p-4 rounded-xl border border-border">
                      <span>Send this email</span>
                      <div className="w-20">
                        <Input
                          type="number"
                          min={0}
                          value={triggerRule.daysOffset}
                          onChange={(e) => setTriggerRule(prev => ({ ...prev, daysOffset: parseInt(e.target.value) || 0 }))}
                          className="h-9 bg-background border-border text-foreground text-center font-semibold"
                        />
                      </div>
                      <span>days</span>
                      <div className="w-36">
                        <Select
                          value={triggerRule.timingType}
                          onValueChange={(val: "before" | "on" | "after") => setTriggerRule(prev => ({ ...prev, timingType: val }))}
                        >
                          <SelectTrigger className="h-9 bg-background border-border text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before">Before</SelectItem>
                            <SelectItem value="on">On the day of</SelectItem>
                            <SelectItem value="after">After</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <span>the date stored in the</span>
                      <div className="w-48">
                        <Select
                          value={triggerRule.dateFieldKey}
                          onValueChange={(val) => setTriggerRule(prev => ({ ...prev, dateFieldKey: val }))}
                        >
                          <SelectTrigger className="h-9 bg-background border-border text-foreground">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customFields.map((field) => (
                              <SelectItem key={field} value={field}>
                                {field}
                              </SelectItem>
                            ))}
                            {customFields.length === 0 && (
                              <SelectItem value="DOB" disabled>No date columns found in select leads</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <span>field.</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Don't see your column? Type it manually:</span>
                      <Input
                        placeholder="e.g. Birthday, renewal_date"
                        value={triggerRule.dateFieldKey}
                        onChange={(e) => setTriggerRule(prev => ({ ...prev, dateFieldKey: e.target.value }))}
                        className="h-7 w-48 text-xs bg-background border-border"
                      />
                    </div>

                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-primary" />
                      <span>
                        <strong>Logic sentence summary:</strong> {ruleSentence}
                      </span>
                    </div>
                  </div>
                )}

                {campaignType === "ai" ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Need help drafting the brief?</p>
                        <p className="text-xs text-muted-foreground">
                          Use AI to turn your brand guidelines and selected leads into a campaign brief.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate("/company-profile")}
                          className="text-xs h-9"
                        >
                          Manage Company Profile
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void generateCampaignBrief()}
                          disabled={generatingPitch}
                          className="gap-2 text-xs h-9 bg-primary hover:bg-primary/95 text-white font-medium shadow-[0_4px_12px_rgba(255,102,0,0.15)]"
                        >
                          {generatingPitch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {generatingPitch ? "Generating..." : "AI Generate Brief"}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        AI Campaign Brief
                      </label>
                      <Textarea
                        placeholder="Example: We help dental clinics book more local patients with AI-assisted lead response, missed-call follow-up, and automated review requests..."
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        className="min-h-[220px]"
                      />
                    </div>
                    <div className="flex justify-end text-xs text-muted-foreground">
                      <span>{pitch.trim().length} chars</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Pre-built Niche Templates Selector */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-primary uppercase tracking-wider block">
                          Pre-built Niche Templates
                        </label>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          💡 Save time by choosing a pre-designed premium HTML template. Customize content, logos, and offers directly in the editor.
                        </p>
                      </div>
                      {baseHtmlTemplate && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Clear the current pre-built template and write your own email from scratch?")) {
                              setBaseHtmlTemplate("");
                              setEditorMode("code");
                              setBodyTemplate("");
                              setSubjectTemplate("");
                            }
                          }}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-zinc-300/40 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 font-semibold transition-colors"
                          title="Clear template and write your own email"
                        >
                          ✕ Write My Own
                        </button>
                      )}
                    </div>
                    <Select
                      onValueChange={(val) => {
                        const selected = PREBUILT_TEMPLATES.find((t) => t.name === val);
                        if (!selected) return;

                        const hasExistingContent = subjectTemplate.trim() || bodyTemplate.trim();
                        if (hasExistingContent) {
                          if (
                            !window.confirm(
                              "Loading this pre-built template will overwrite your current subject and email message. Do you want to proceed?"
                            )
                          ) {
                            return;
                          }
                        }
                        setSubjectTemplate(selected.subject);
                        setBaseHtmlTemplate(selected.body);
                        setCustomizerValues(selected.customizerDefaults);
                        setEditorMode("form");
                        setBodyTemplate(compileHtmlTemplate(selected.body, selected.customizerDefaults));
                        toast({
                          title: "Template Loaded",
                          description: `Successfully loaded "${selected.name}" template.`,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 bg-background border-border text-foreground">
                        <SelectValue placeholder="Select pre-designed template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PREBUILT_TEMPLATES.map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {editorMode === "form" && baseHtmlTemplate ? (
                      <div className="glass-panel rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            Visual Template Customizer
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Fill out simple fields to update template HTML
                          </span>
                        </div>
                        
                        <Tabs defaultValue="branding" className="w-full">
                          <TabsList className="grid w-full grid-cols-3 bg-muted/40 p-1 border border-border/60 rounded-xl mb-4">
                            <TabsTrigger value="branding" className="text-xs font-semibold py-1.5">Branding & Promo</TabsTrigger>
                            <TabsTrigger value="products" className="text-xs font-semibold py-1.5">Catalog Products</TabsTrigger>
                            <TabsTrigger value="actions" className="text-xs font-semibold py-1.5">CTA Actions</TabsTrigger>
                          </TabsList>

                          <TabsContent value="branding" className="space-y-3.5">
                            {/* Page-level section toggles */}
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Global Section Visibility</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { key: "show_logo", label: "Logo" },
                                  { key: "show_promo_banner", label: "Header Banner" },
                                  { key: "show_intro_text", label: "Intro Text" },
                                  { key: "show_cta", label: "CTA Button" },
                                  { key: "show_footer", label: "Footer" },
                                  { key: "show_socials", label: "Social Links" },
                                ] as const).map(({ key, label }) => {
                                  const visible = customizerValues[key] !== "false";
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => setCustomizerValues(prev => ({ ...prev, [key]: visible ? "false" : "true" }))}
                                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
                                        visible
                                          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                          : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400 line-through hover:bg-zinc-500/20"
                                      }`}
                                    >
                                      {visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Business Name</label>
                                <Input
                                  value={customizerValues.business_name || ""}
                                  onChange={(e) => setCustomizerValues(prev => ({ ...prev, business_name: e.target.value }))}
                                  className="bg-background border-border text-foreground h-9 animate-none"
                                  placeholder="e.g. Vesela Pani"
                                />
                              </div>
                              <InlineImageUploader
                                label="Logo Image URL"
                                value={customizerValues.logo_url || ""}
                                onChange={(url) => setCustomizerValues(prev => ({ ...prev, logo_url: url }))}
                                toast={toast}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main Promotion Title</label>
                              <Input
                                value={customizerValues.promo_title || ""}
                                onChange={(e) => setCustomizerValues(prev => ({ ...prev, promo_title: e.target.value }))}
                                className="bg-background border-border text-foreground h-9"
                                placeholder="Special celebration offer title..."
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coupon Code</label>
                                <button
                                  type="button"
                                  title={customizerValues.show_coupon_box !== "false" ? "Click to hide the coupon box in template" : "Click to show the coupon box"}
                                  onClick={() => setCustomizerValues(prev => ({ ...prev, show_coupon_box: prev.show_coupon_box === "false" ? "true" : "false" }))}
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                    customizerValues.show_coupon_box !== "false"
                                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                      : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20"
                                  }`}
                                >
                                  {customizerValues.show_coupon_box !== "false" ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                                  {customizerValues.show_coupon_box !== "false" ? "Visible" : "Hidden"}
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  value={customizerValues.coupon_code || ""}
                                  onChange={(e) => setCustomizerValues(prev => ({ ...prev, coupon_code: e.target.value }))}
                                  className="bg-background border-border text-foreground h-9 font-mono"
                                  placeholder="e.g. BDAY20OFF"
                                />
                                <Input
                                  value={customizerValues.discount_value || ""}
                                  onChange={(e) => setCustomizerValues(prev => ({ ...prev, discount_value: e.target.value }))}
                                  className="bg-background border-border text-foreground h-9"
                                  placeholder="e.g. 20% or €20"
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground">Left: coupon code &nbsp;|&nbsp; Right: discount value</p>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Terms &amp; Fine Print</label>
                                <button
                                  type="button"
                                  title={customizerValues.show_promo_terms !== "false" ? "Click to hide fine print in template" : "Click to show fine print"}
                                  onClick={() => setCustomizerValues(prev => ({ ...prev, show_promo_terms: prev.show_promo_terms === "false" ? "true" : "false" }))}
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                    customizerValues.show_promo_terms !== "false"
                                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                      : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20"
                                  }`}
                                >
                                  {customizerValues.show_promo_terms !== "false" ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                                  {customizerValues.show_promo_terms !== "false" ? "Visible" : "Hidden"}
                                </button>
                              </div>
                              <Input
                                value={customizerValues.promo_terms || ""}
                                onChange={(e) => setCustomizerValues(prev => ({ ...prev, promo_terms: e.target.value }))}
                                className="bg-background border-border text-foreground h-9"
                                placeholder="e.g. *Code expires 30 days from today. Cannot be combined with other offers."
                              />
                            </div>
                          </TabsContent>

                          <TabsContent value="products" className="space-y-4">
                            {/* Section visibility controls */}
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Section Visibility</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { key: "show_product_header_1", label: "Header 1" },
                                  { key: "show_product_row1", label: "Row 1 (Prod 1&2)" },
                                  { key: "show_product_header_2", label: "Header 2" },
                                  { key: "show_product_row2", label: "Row 2 (Prod 3&4)" },
                                ] as const).map(({ key, label }) => {
                                  const visible = customizerValues[key] !== "false";
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => setCustomizerValues(prev => ({ ...prev, [key]: visible ? "false" : "true" }))}
                                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
                                        visible
                                          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                          : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400 line-through hover:bg-zinc-500/20"
                                      }`}
                                    >
                                      {visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Header 1</label>
                                <Input
                                  value={customizerValues.product_header_1 || ""}
                                  onChange={(e) => setCustomizerValues(prev => ({ ...prev, product_header_1: e.target.value }))}
                                  className="bg-background border-border text-foreground h-9"
                                  placeholder="Header above product grid 1..."
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Header 2 (Optional)</label>
                                <Input
                                  value={customizerValues.product_header_2 || ""}
                                  onChange={(e) => setCustomizerValues(prev => ({ ...prev, product_header_2: e.target.value }))}
                                  className="bg-background border-border text-foreground h-9"
                                  placeholder="Header above product grid 2..."
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Product 1 */}
                              <div className="bg-background/40 border border-border/80 p-3 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Product 1</span>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod1_image: prev.show_prod1_image === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod1_image !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod1_image !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Image
                                    </button>
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod1_price: prev.show_prod1_price === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod1_price !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod1_price !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Price
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Input
                                    value={customizerValues.prod1_name || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod1_name: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Product Name"
                                  />
                                  <Input
                                    value={customizerValues.prod1_price || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod1_price: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Price (e.g. €23 / 1 kg)"
                                  />
                                  <InlineImageUploader
                                    label="Product 1 Image URL"
                                    value={customizerValues.prod1_image || ""}
                                    onChange={(url) => setCustomizerValues(prev => ({ ...prev, prod1_image: url }))}
                                    toast={toast}
                                  />
                                </div>
                              </div>

                              {/* Product 2 */}
                              <div className="bg-background/40 border border-border/80 p-3 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Product 2</span>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod2_image: prev.show_prod2_image === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod2_image !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod2_image !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Image
                                    </button>
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod2_price: prev.show_prod2_price === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod2_price !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod2_price !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Price
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Input
                                    value={customizerValues.prod2_name || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod2_name: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Product Name"
                                  />
                                  <Input
                                    value={customizerValues.prod2_price || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod2_price: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Price"
                                  />
                                  <InlineImageUploader
                                    label="Product 2 Image URL"
                                    value={customizerValues.prod2_image || ""}
                                    onChange={(url) => setCustomizerValues(prev => ({ ...prev, prod2_image: url }))}
                                    toast={toast}
                                  />
                                </div>
                              </div>

                              {/* Product 3 */}
                              <div className="bg-background/40 border border-border/80 p-3 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Product 3</span>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod3_image: prev.show_prod3_image === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod3_image !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod3_image !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Image
                                    </button>
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod3_price: prev.show_prod3_price === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod3_price !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod3_price !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Price
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Input
                                    value={customizerValues.prod3_name || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod3_name: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Product Name"
                                  />
                                  <Input
                                    value={customizerValues.prod3_price || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod3_price: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Price"
                                  />
                                  <InlineImageUploader
                                    label="Product 3 Image URL"
                                    value={customizerValues.prod3_image || ""}
                                    onChange={(url) => setCustomizerValues(prev => ({ ...prev, prod3_image: url }))}
                                    toast={toast}
                                  />
                                </div>
                              </div>

                              {/* Product 4 */}
                              <div className="bg-background/40 border border-border/80 p-3 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Product 4</span>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod4_image: prev.show_prod4_image === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod4_image !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod4_image !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Image
                                    </button>
                                    <button type="button" onClick={() => setCustomizerValues(prev => ({ ...prev, show_prod4_price: prev.show_prod4_price === "false" ? "true" : "false" }))} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${customizerValues.show_prod4_price !== "false" ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-300/40 bg-zinc-500/10 text-zinc-400"}`}>
                                      {customizerValues.show_prod4_price !== "false" ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />} Price
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Input
                                    value={customizerValues.prod4_name || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod4_name: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Product Name"
                                  />
                                  <Input
                                    value={customizerValues.prod4_price || ""}
                                    onChange={(e) => setCustomizerValues(prev => ({ ...prev, prod4_price: e.target.value }))}
                                    className="bg-background border-border text-foreground h-8 text-xs"
                                    placeholder="Price"
                                  />
                                  <InlineImageUploader
                                    label="Product 4 Image URL"
                                    value={customizerValues.prod4_image || ""}
                                    onChange={(url) => setCustomizerValues(prev => ({ ...prev, prod4_image: url }))}
                                    toast={toast}
                                  />
                                </div>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="actions" className="space-y-3.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CTA Button Text</label>
                              <Input
                                value={customizerValues.cta_text || ""}
                                onChange={(e) => setCustomizerValues(prev => ({ ...prev, cta_text: e.target.value }))}
                                className="bg-background border-border text-foreground h-9"
                                placeholder="e.g. Request Catering or Shop Now"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CTA Action Link</label>
                              <Input
                                value={customizerValues.cta_link || ""}
                                onChange={(e) => setCustomizerValues(prev => ({ ...prev, cta_link: e.target.value }))}
                                className="bg-background border-border text-foreground h-9 font-mono text-xs"
                                placeholder="e.g. mailto:sales@mybiz.com or https://mybiz.com/shop"
                              />
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                          <div>
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Smart Auto-Fields</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              💡 Click inside the Email Subject or Message field below, then click any button to insert a dynamic replacement tag.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "👤 Contact Name", tag: "{{name}}" },
                              { label: "🏢 Company Name", tag: "{{business}}" },
                              { label: "📍 Location", tag: "{{location}}" },
                              { label: "💼 Industry", tag: "{{industry}}" },
                              { label: "🌐 Website", tag: "{{website}}" },
                              ...customFields.map((field) => ({
                                label: `✨ ${field}`,
                                tag: `{{${field}}}`,
                              })),
                            ].map(item => (
                              <button
                                key={item.tag}
                                type="button"
                                onClick={() => insertTag(item.tag)}
                                className="text-xs font-semibold bg-background hover:bg-primary/10 border border-primary/20 text-primary hover:text-primary/80 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Email Message
                          </label>
                          <textarea
                            ref={bodyRef}
                            rows={12}
                            value={bodyTemplate}
                            onChange={(e) => setBodyTemplate(e.target.value)}
                            placeholder="Hello {{name}},\n\nI noticed your business, {{business}}, in {{location}}..."
                            className="w-full font-mono rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Email Subject
                      </label>
                      <Input
                        ref={subjectRef}
                        placeholder="e.g. Quick question for {{name}} regarding {{business}}"
                        value={subjectTemplate}
                        onChange={(e) => setSubjectTemplate(e.target.value)}
                        className="bg-background border-border text-foreground"
                      />
                    </div>

                    {baseHtmlTemplate && (
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (editorMode === "form") {
                              setEditorMode("code");
                              toast({
                                title: "Raw HTML Editor",
                                description: "You can now edit the full generated HTML code directly.",
                              });
                            } else {
                              if (window.confirm("Switching back to Visual Customizer will regenerate the code using form fields. Custom code modifications will be lost. Do you want to proceed?")) {
                                setEditorMode("form");
                                setBodyTemplate(compileHtmlTemplate(baseHtmlTemplate, customizerValues));
                              }
                            }
                          }}
                          className="text-xs font-semibold text-primary hover:text-primary/80 hover:bg-primary/5 gap-1.5"
                        >
                          {editorMode === "form" ? "🛠️ Switch to Raw HTML Code View" : "✨ Switch to Form Customizer"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Schedule for Later */}
                {(campaignType === "ai" || campaignType === "manual") && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-primary" /> Schedule for Later
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        💡 Optional: Choose a future date and time to run this campaign. Leave empty to run immediately.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-full sm:w-64">
                        <Input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="bg-background border-border text-foreground h-9 font-medium"
                        />
                      </div>
                      {scheduledAt && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setScheduledAt("")}
                          className="text-xs text-zinc-500 hover:text-zinc-700 h-9 px-2 hover:bg-zinc-500/5"
                        >
                          Clear Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (Span 1): Premium Webmail Live Preview Client */}
              <div className="space-y-6 w-full">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Mail className="h-4.5 w-4.5 text-primary" />
                    Live Preview Draft
                  </h3>
                  {campaignType !== "ai" && baseHtmlTemplate && (
                    <div className="flex bg-muted/40 border border-border/80 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewMode("desktop")}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                          previewMode === "desktop"
                            ? "bg-primary text-white shadow"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        🖥️ Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode("mobile")}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                          previewMode === "mobile"
                            ? "bg-primary text-white shadow"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        📱 Mobile
                      </button>
                    </div>
                  )}
                </div>

                {/* Simulated Webmail / Browser Mockup */}
                <div className="flex flex-col items-center w-full">
                  <div
                    className={`w-full rounded-2xl border border-border/80 bg-background/50 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
                      previewMode === "mobile" && campaignType !== "ai" && baseHtmlTemplate
                        ? "max-w-[375px] border-4 border-muted/80 rounded-[2.5rem] my-4 shadow-primary/5"
                        : "w-full"
                    }`}
                  >
                    {/* Simulated Phone Notch / Speaker for Mobile Mockup */}
                    {previewMode === "mobile" && campaignType !== "ai" && baseHtmlTemplate && (
                      <div className="w-full flex justify-center pt-3 pb-2 bg-muted/20 border-b border-border/20 shrink-0">
                        <div className="w-24 h-4 bg-muted-foreground/35 rounded-full flex items-center justify-center">
                          <div className="w-12 h-1 bg-muted-foreground/20 rounded-full" />
                        </div>
                      </div>
                    )}

                    {/* Webmail Inbox Header / Toolbar */}
                    <div className="bg-muted/30 border-b border-border px-4 py-3.5 space-y-2.5 text-xs shrink-0">
                      <div className="flex items-center justify-between text-muted-foreground border-b border-border/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/70" />
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500/70" />
                        </div>
                        <span className="font-mono text-[10px] tracking-wide text-muted-foreground/80">
                          {previewMode === "mobile" ? "Secure Mail App" : "https://webmail.yourserver.com/inbox"}
                        </span>
                      </div>

                      <div className="flex items-center text-muted-foreground">
                        <span className="w-14 font-semibold text-muted-foreground/75">To:</span>
                        <span className="text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40 font-mono text-[11px]">
                          {sampleLead
                            ? `${sampleLead.name} <${sampleLead.email || "email@example.com"}>`
                            : "[Contact Name] <email@example.com>"
                          }
                        </span>
                      </div>

                      {campaignType !== "ai" ? (
                        <div className="flex items-center text-muted-foreground">
                          <span className="w-14 font-semibold text-muted-foreground/75">Subject:</span>
                          <span className="text-foreground font-bold tracking-tight text-[12px] truncate">
                            {renderTemplate(subjectTemplate, sampleLead) || <span className="text-muted-foreground/60 italic font-normal">[No Subject Provided]</span>}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center text-muted-foreground">
                          <span className="w-14 font-semibold text-muted-foreground/75">Subject:</span>
                          <span className="text-primary italic font-semibold flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5" /> AI Personalized Subject
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Email Body Iframe / Container */}
                    <div
                      className="p-0 overflow-y-auto bg-background rounded-b-xl border-t border-border/40 relative flex flex-col"
                      style={{ minHeight: '480px', maxHeight: '680px' }}
                    >
                      {campaignType !== "ai" ? (
                        (() => {
                          const previewSource = (editorMode === "form" && compiledHtmlBody) ? compiledHtmlBody : bodyTemplate;
                          const renderedBody = renderTemplate(previewSource, sampleLead);
                          if (!renderedBody) {
                            return (
                              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                <Mail className="h-8 w-8 text-muted-foreground/45 mb-2 animate-bounce" />
                                <p className="text-xs italic">Email content is empty. Choose a template or type in the customizer/editor to start previewing!</p>
                              </div>
                            );
                          }
                          const isHtml = /<\/?[a-z][\s\S]*>/i.test(renderedBody);
                          if (isHtml) {
                            return (
                              <iframe
                                srcDoc={renderedBody}
                                title="HTML Email Preview"
                                className="w-full border-0 bg-white block"
                                style={{ minHeight: '620px', height: '100%' }}
                                sandbox="allow-same-origin allow-popups"
                              />
                            );
                          }
                          return (
                            <div className="flex-1 p-5 text-xs text-foreground font-sans whitespace-pre-wrap leading-relaxed overflow-y-auto bg-white/5">
                              {renderedBody}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex-1 p-6 text-muted-foreground space-y-4 text-xs font-sans bg-muted/5 overflow-y-auto">
                          <div className="flex items-center gap-2 p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary font-semibold shadow-inner">
                            <Sparkles className="h-4 w-4 animate-pulse" />
                            <span>AI Outreach Personalization Engine Active</span>
                          </div>
                          <p className="leading-relaxed text-muted-foreground/90">
                            Each recipient will receive a unique email custom-crafted by AI based on their specific business context, location, and industry.
                          </p>
                          <div className="bg-background border border-border/60 p-4 rounded-xl space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">AI Prompt / Brief Directive</span>
                            <p className="font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
                              {pitch || "No brief configured. Please write a brief directive in the editor."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Simulated Phone Bottom Bar for Mobile Mockup */}
                    {previewMode === "mobile" && campaignType !== "ai" && baseHtmlTemplate && (
                      <div className="w-full flex justify-center pb-3 pt-2 bg-muted/20 shrink-0 border-t border-border/20">
                        <div className="w-28 h-1 bg-muted-foreground/35 rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Step 3 Footer Navigation */}
            <div className="flex justify-between items-center gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Audience
              </Button>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Duration</span>
                  <span className="text-xs font-bold text-primary">
                    {getDeliveryTimeEstimate(selectedLeadIds.length, campaignType)}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    if (campaignType === "ai") {
                      if (pitch.trim().length < 20) {
                        toast({
                          title: "Brief is too short",
                          description: "Please write a campaign brief of at least 20 characters.",
                          variant: "destructive",
                        });
                        return;
                      }
                    } else {
                      if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
                        toast({
                          title: "Template incomplete",
                          description: "Both Email Subject and Email Message body are required.",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (campaignType === "automated" && !triggerRule.dateFieldKey.trim()) {
                        toast({
                          title: "Trigger Field Required",
                          description: "Please specify the date field key that triggers this automation.",
                          variant: "destructive",
                        });
                        return;
                      }
                    }
                    void createCampaign();
                  }}
                  disabled={creatingCampaign}
                  className="min-w-[200px] gap-2 bg-primary hover:bg-primary/95 text-white font-semibold shadow-[0_0_20px_rgba(255,102,0,0.3)] transition-all hover:shadow-[0_0_25px_rgba(255,102,0,0.5)]"
                >
                  {creatingCampaign ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting Campaign...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Launch Campaign
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}