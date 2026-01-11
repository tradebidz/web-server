package com.tradebidz.core_service.core.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final int MAX_REQUESTS = 100;
    private static final long TIME_WINDOW = 60000; // 1 minute

    private final Map<String, RequestCounter> requestCounts = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String clientIp = request.getRemoteAddr();
        long currentTime = System.currentTimeMillis();

        requestCounts.putIfAbsent(clientIp, new RequestCounter(currentTime));
        RequestCounter counter = requestCounts.get(clientIp);

        synchronized (counter) {
            if (currentTime - counter.startTime.get() > TIME_WINDOW) {
                counter.startTime.set(currentTime);
                counter.count.set(0);
            }

            if (counter.count.incrementAndGet() > MAX_REQUESTS) {
                response.setStatus(429); // Too Many Requests
                response.getWriter().write("Too many requests");
                return false;
            }
        }

        return true;
    }

    private static class RequestCounter {
        final AtomicLong startTime;
        final AtomicInteger count;

        RequestCounter(long startTime) {
            this.startTime = new AtomicLong(startTime);
            this.count = new AtomicInteger(0);
        }
    }
}
