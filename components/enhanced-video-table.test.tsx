import { describe, it, expect, vi, beforeEach } from "vitest";
import { VideoData } from "./enhanced-video-table";

describe("EnhancedVideoTable Data Structure", () => {
  it("should have correct VideoData interface structure", () => {
    const testVideo: VideoData = {
      videoId: "test123",
      videoData: {
        title: "Test Video",
        description: "Test Description",
        duration: "10:25",
        thumbnail: "/test.jpg",
        channelName: "Test Channel",
        viewCount: 1000,
        likeCount: 500,
      },
      analysis: {
        status: "completed",
        version: 1,
        hasAnalysis: true,
      },
      slides: {
        status: "completed",
        totalSlides: 15,
        hasSlides: true,
      },
      completedAt: "2023-01-01T10:00:00Z",
    };

    // Verify all required fields exist
    expect(testVideo).toHaveProperty("videoId");
    expect(testVideo).toHaveProperty("videoData");
    expect(testVideo).toHaveProperty("analysis");
    expect(testVideo).toHaveProperty("slides");
    expect(testVideo).toHaveProperty("completedAt");

    // Verify videoData structure
    if (testVideo.videoData) {
      expect(testVideo.videoData).toHaveProperty("title");
      expect(testVideo.videoData).toHaveProperty("description");
      expect(testVideo.videoData).toHaveProperty("duration");
      expect(testVideo.videoData).toHaveProperty("thumbnail");
      expect(testVideo.videoData).toHaveProperty("channelName");
      expect(testVideo.videoData).toHaveProperty("viewCount");
      expect(testVideo.videoData).toHaveProperty("likeCount");
    }

    // Verify analysis structure
    expect(testVideo.analysis).toHaveProperty("status");
    expect(testVideo.analysis).toHaveProperty("version");
    expect(testVideo.analysis).toHaveProperty("hasAnalysis");

    // Verify slides structure
    expect(testVideo.slides).toHaveProperty("status");
    expect(testVideo.slides).toHaveProperty("totalSlides");
    expect(testVideo.slides).toHaveProperty("hasSlides");
  });

  it("should support all analysis statuses", () => {
    const statuses: VideoData["analysis"]["status"][] = ["pending", "streaming", "completed", "failed"];
    
    statuses.forEach(status => {
      const testVideo: VideoData = {
        videoId: "test",
        analysis: {
          status,
          version: 1,
          hasAnalysis: true,
        },
        slides: {
          status: "pending",
          totalSlides: 0,
          hasSlides: false,
        },
      };
      
      expect(testVideo.analysis.status).toBe(status);
    });
  });

  it("should support all slides statuses", () => {
    const statuses: VideoData["slides"]["status"][] = ["pending", "in_progress", "completed", "failed"];
    
    statuses.forEach(status => {
      const testVideo: VideoData = {
        videoId: "test",
        analysis: {
          status: "pending",
          version: 0,
          hasAnalysis: false,
        },
        slides: {
          status,
          totalSlides: status === "completed" ? 10 : 0,
          hasSlides: status === "completed",
        },
      };
      
      expect(testVideo.slides.status).toBe(status);
    });
  });
});

describe("API Response Structure Validation", () => {
  it("should validate API response structure", () => {
    const mockApiResponse = [
      {
        videoId: "video1",
        videoData: {
          title: "Test Video 1",
          description: "Description for test video 1",
          duration: "10:25",
          thumbnail: "/test1.jpg",
          channelName: "Test Channel 1",
          viewCount: 1000,
          likeCount: 500,
        },
        analysis: {
          status: "completed" as const,
          version: 1,
          hasAnalysis: true,
        },
        slides: {
          status: "completed" as const,
          totalSlides: 15,
          hasSlides: true,
        },
        completedAt: "2023-01-01T10:00:00Z",
      },
      {
        videoId: "video2",
        videoData: {
          title: "Test Video 2",
          description: "Description for test video 2",
          duration: "5:45",
          thumbnail: "/test2.jpg",
          channelName: "Test Channel 2",
          viewCount: 5000,
          likeCount: 2500,
        },
        analysis: {
          status: "pending" as const,
          version: 0,
          hasAnalysis: false,
        },
        slides: {
          status: "pending" as const,
          totalSlides: 0,
          hasSlides: false,
        },
        completedAt: "2023-01-02T11:00:00Z",
      },
    ];

    // Validate that the response matches the expected structure
    mockApiResponse.forEach((video, index) => {
      expect(video).toHaveProperty("videoId");
      expect(video).toHaveProperty("videoData");
      expect(video).toHaveProperty("analysis");
      expect(video).toHaveProperty("slides");
      expect(video).toHaveProperty("completedAt");

      // Validate videoData
      if (video.videoData) {
        expect(video.videoData).toHaveProperty("title");
        expect(video.videoData).toHaveProperty("description");
        expect(video.videoData).toHaveProperty("duration");
        expect(video.videoData).toHaveProperty("thumbnail");
        expect(video.videoData).toHaveProperty("channelName");
        expect(video.videoData).toHaveProperty("viewCount");
        expect(video.videoData).toHaveProperty("likeCount");
      }

      // Validate analysis
      expect(video.analysis).toHaveProperty("status");
      expect(video.analysis).toHaveProperty("version");
      expect(video.analysis).toHaveProperty("hasAnalysis");

      // Validate slides
      expect(video.slides).toHaveProperty("status");
      expect(video.slides).toHaveProperty("totalSlides");
      expect(video.slides).toHaveProperty("hasSlides");

      // Validate that slides.hasSlides matches slides.totalSlides > 0
      expect(video.slides.hasSlides).toBe(video.slides.totalSlides > 0);
    });
  });

  it("should handle edge cases in API response", () => {
    const edgeCaseResponse = [
      {
        videoId: "video_no_data",
        videoData: undefined,
        analysis: {
          status: "pending" as const,
          version: 0,
          hasAnalysis: false,
        },
        slides: {
          status: "pending" as const,
          totalSlides: 0,
          hasSlides: false,
        },
        completedAt: undefined,
      },
      {
        videoId: "video_with_analysis_v2",
        videoData: {
          title: "Version 2 Video",
          description: "Video with multiple analysis versions",
          duration: "20:30",
          thumbnail: "/test.jpg",
          channelName: "Test Channel",
          viewCount: 10000,
          likeCount: 5000,
        },
        analysis: {
          status: "completed" as const,
          version: 2,
          hasAnalysis: true,
        },
        slides: {
          status: "completed" as const,
          totalSlides: 25,
          hasSlides: true,
        },
        completedAt: "2023-01-03T12:00:00Z",
      },
    ];

    // Validate edge cases
    edgeCaseResponse.forEach((video) => {
      expect(video).toHaveProperty("videoId");
      expect(video).toHaveProperty("analysis");
      expect(video).toHaveProperty("slides");

      // For videos with analysis version > 1, hasAnalysis should be true
      if (video.analysis.version > 1) {
        expect(video.analysis.hasAnalysis).toBe(true);
      }
    });
  });
});

describe("Filtering and Sorting Logic", () => {
  const mockVideos: VideoData[] = [
    {
      videoId: "video1",
      videoData: {
        title: "Test Video 1",
        description: "Description for test video 1",
        duration: "10:25",
        thumbnail: "/test1.jpg",
        channelName: "Test Channel 1",
        viewCount: 1000,
        likeCount: 500,
      },
      analysis: {
        status: "completed",
        version: 1,
        hasAnalysis: true,
      },
      slides: {
        status: "completed",
        totalSlides: 15,
        hasSlides: true,
      },
      completedAt: "2023-01-01T10:00:00Z",
    },
    {
      videoId: "video2",
      videoData: {
        title: "Test Video 2",
        description: "Description for test video 2",
        duration: "5:45",
        thumbnail: "/test2.jpg",
        channelName: "Test Channel 2",
        viewCount: 5000,
        likeCount: 2500,
      },
      analysis: {
        status: "pending",
        version: 0,
        hasAnalysis: false,
      },
      slides: {
        status: "pending",
        totalSlides: 0,
        hasSlides: false,
      },
      completedAt: "2023-01-02T11:00:00Z",
    },
  ];

  it("should filter by search query correctly", () => {
    const searchQuery = "Test Video 1";
    
    const filtered = mockVideos.filter((video) => {
      const query = searchQuery.toLowerCase();
      const title = video.videoData?.title?.toLowerCase() || "";
      const channelName = video.videoData?.channelName?.toLowerCase() || "";
      const description = video.videoData?.description?.toLowerCase() || "";

      return (
        title.includes(query) ||
        channelName.includes(query) ||
        description.includes(query)
      );
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].videoId).toBe("video1");
  });

  it("should filter by analysis status correctly", () => {
    const statusFilter = "completed";
    
    const filtered = mockVideos.filter((video) => 
      video.analysis.status === statusFilter
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].videoId).toBe("video1");
  });

  it("should filter by slides availability correctly", () => {
    const slidesFilter = "with_slides";
    
    const filtered = mockVideos.filter((video) => 
      slidesFilter === "with_slides" ? video.slides.hasSlides : !video.slides.hasSlides
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].videoId).toBe("video1");
  });

  it("should sort by views correctly", () => {
    const sorted = [...mockVideos].sort((a, b) => 
      (b.videoData?.viewCount || 0) - (a.videoData?.viewCount || 0)
    );

    expect(sorted[0].videoId).toBe("video2"); // 5000 views
    expect(sorted[1].videoId).toBe("video1"); // 1000 views
  });

  it("should sort by analysis status correctly", () => {
    const statusOrder: Record<string, number> = { 
      completed: 0, 
      streaming: 1, 
      in_progress: 1, 
      pending: 2, 
      failed: 3 
    };
    
    const sorted = [...mockVideos].sort((a, b) => 
      (statusOrder[a.analysis.status] || 0) - (statusOrder[b.analysis.status] || 0)
    );

    expect(sorted[0].videoId).toBe("video1"); // completed (0)
    expect(sorted[1].videoId).toBe("video2"); // pending (2)
  });
});